const { ApiError, KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const env = require("../config/env");
const redisClient = require("@bidx/shared/redis/redis-client");
const { DistributedLock } = require("../utils/distributed-lock.util");
const { bidRepository, BID_STATUS } = require("../models/bid.model");
const auctionRead = require("../models/auction-read.model");
const emitter = require("../socket/emitter");

const lock = new DistributedLock(redisClient);

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    console.error(`Event publish failed for ${topic}: ${err.message}`);
  }
}

function requiredAmount(auction) {
  return auction.currentBid > 0
    ? auction.currentBid + auction.minimumIncrement
    : auction.startingPrice;
}

class BidService {
  async place({ auctionId, bidderId, amount, idempotencyKey }) {
    if (!Number.isFinite(amount) || amount < 1 || !Number.isInteger(amount)) {
      throw ApiError.badRequest("amount must be a positive integer");
    }

    let replayedResponse = null;
    if (idempotencyKey) {
      const cached = await redisClient.get(`idem:bid:${idempotencyKey}`);
      if (cached) {
        replayedResponse = cached;
      }
    }
    if (replayedResponse) {
      return { ...replayedResponse, replayed: true };
    }

    const lockKey = `lock:auction:${auctionId}`;
    let acquired = null;
    for (let attempt = 0; attempt < env.lock.acquireRetries; attempt++) {
      acquired = await lock.acquire(lockKey, env.lock.ttlMs);
      if (acquired) break;
      await new Promise((r) => setTimeout(r, env.lock.retryDelayMs));
    }
    if (!acquired) {
      throw ApiError.tooManyRequests("Auction is busy processing another bid, try again");
    }

    try {
      if (idempotencyKey && replayedResponse === null) {
        const doubleCheck = await redisClient.get(`idem:bid:${idempotencyKey}`);
        if (doubleCheck) {
          return { ...doubleCheck, replayed: true };
        }
      }

      const result = await this.placeWithOccRetry({ auctionId, bidderId, amount });

      if (idempotencyKey) {
        await redisClient.set(`idem:bid:${idempotencyKey}`, result, env.idempotencyTtlSeconds);
      }

      return result;
    } finally {
      await lock.release(acquired);
    }
  }

  async placeWithOccRetry({ auctionId, bidderId, amount }) {
    let lastError = null;

    for (let attempt = 0; attempt <= env.occMaxRetries; attempt++) {
      const Auction = auctionRead.getModel();
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        throw ApiError.notFound("Auction not found");
      }

      try {
        return await this.applyBid({ auction, auctionId, bidderId, amount });
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        lastError = err;
        // version conflict -> re-read and retry
      }
    }

    throw ApiError.conflict("Concurrent bid conflict, please retry");
  }

  async applyBid({ auction, auctionId, bidderId, amount }) {
    if (auction.status !== "LIVE") {
      throw ApiError.conflict(`Bids are only accepted on LIVE auctions (current: ${auction.status})`);
    }
    if (new Date(auction.endTime).getTime() <= Date.now()) {
      throw ApiError.conflict("Auction has already ended");
    }
    if (String(auction.sellerId) === String(bidderId)) {
      throw ApiError.forbidden("Sellers cannot bid on their own auctions");
    }

    const minimumRequired = requiredAmount(auction);
    if (amount < minimumRequired) {
      throw ApiError.badRequest(
        `Bid must be at least ${minimumRequired} (currentBid ${auction.currentBid} + increment ${auction.minimumIncrement})`
      );
    }

    const Auction = auctionRead.getModel();
    const previousHighestBidderId = auction.highestBidderId
      ? auction.highestBidderId.toString()
      : null;

    const updated = await Auction.findOneAndUpdate(
      { _id: auction._id, version: auction.version },
      {
        $set: { currentBid: amount, highestBidderId: bidderId },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!updated) {
      const conflict = new Error("VersionConflict");
      throw conflict;
    }

    const bid = await bidRepository.create({
      auctionId,
      bidderId,
      amount,
      status: BID_STATUS.ACCEPTED
    });

    const payload = {
      auctionId,
      bidId: bid._id.toString(),
      bidderId,
      amount,
      previousAmount: auction.currentBid,
      previousHighestBidderId,
      currentBid: updated.currentBid,
      createdAt: bid.createdAt.toISOString()
    };

    await safePublish(KAFKA_TOPICS.BID_PLACED, payload, auctionId);
    await safePublish(
      KAFKA_TOPICS.BID_ACCEPTED,
      {
        auctionId,
        bidId: payload.bidId,
        bidderId,
        amount,
        newCurrentBid: updated.currentBid,
        sellerId: auction.sellerId.toString()
      },
      auctionId
    );

    if (previousHighestBidderId && previousHighestBidderId !== String(bidderId)) {
      await safePublish(
        KAFKA_TOPICS.NOTIFICATION_EMAIL,
        {
          type: "OUTBID",
          userId: previousHighestBidderId,
          auctionId,
          previousAmount: auction.currentBid,
          currentBid: updated.currentBid
        },
        previousHighestBidderId
      );
    }

    emitter.emitBidNew(payload);
    emitter.emitBidOutbid(payload);

    return {
      bid: {
        id: bid._id.toString(),
        auctionId,
        bidderId,
        amount,
        status: bid.status,
        createdAt: payload.createdAt
      },
      auction: {
        currentBid: updated.currentBid,
        highestBidderId: updated.highestBidderId.toString(),
        version: updated.version
      },
      replayed: false
    };
  }

  async listForAuction(requester, auctionId, { page, limit }) {
    const safePage = Math.max(1, parseInt(page || "1", 10));
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));

    const { items, total } = await bidRepository.listByAuction(auctionId, {
      page: safePage,
      limit: safeLimit
    });

    return {
      items: items.map((bid) => ({
        id: bid._id.toString(),
        auctionId: bid.auctionId.toString(),
        bidderId: String(bid.bidderId),
        amount: bid.amount,
        status: bid.status,
        createdAt: bid.createdAt instanceof Date ? bid.createdAt.toISOString() : bid.createdAt
      })),
      pagination: { page: safePage, limit: safeLimit, total }
    };
  }

  async listMine(bidderId, { page, limit }) {
    const safePage = Math.max(1, parseInt(page || "1", 10));
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));

    const { items, total } = await bidRepository.listMine(bidderId, {
      page: safePage,
      limit: safeLimit
    });

    return {
      items: items.map((bid) => ({
        id: bid._id.toString(),
        auctionId: bid.auctionId.toString(),
        amount: bid.amount,
        status: bid.status,
        createdAt: bid.createdAt instanceof Date ? bid.createdAt.toISOString() : bid.createdAt
      })),
      pagination: { page: safePage, limit: safeLimit, total }
    };
  }
}

module.exports = new BidService();

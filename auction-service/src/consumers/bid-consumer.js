const { KAFKA_TOPICS } = require("@bidx/shared");
const logger = require("@bidx/shared/utils/logger");
const { getKafka } = require("../config/kafka");
const { createRetryingHandler } = require("@bidx/shared/kafka/message-handler");
const dlq = require("@bidx/shared/kafka/dlq");
const Auction = require("../models/auction.model");

class BidConsumer {
  constructor({ groupId, retries, baseDelayMs } = {}) {
    this.groupId = groupId || process.env.AUCTION_BIDS_GROUP_ID || "bidx-auction-bids";
    this.retries = retries || 3;
    this.baseDelayMs = baseDelayMs || 400;
    this.consumer = null;
    this.running = false;
  }

  get isConnected() {
    return this.running;
  }

  invalidPayload(message) {
    const err = new Error(`InvalidPayload: ${message}`);
    err.name = "InvalidPayloadError";
    return err;
  }

  async applyBidPlaced(data) {
    if (!data || typeof data !== "object") {
      throw this.invalidPayload("event data must be an object");
    }
    if (typeof data.auctionId !== "string" || data.auctionId.length < 12) {
      throw this.invalidPayload("auctionId is missing or malformed");
    }
    if (typeof data.bidderId !== "string" || data.bidderId.length < 12) {
      throw this.invalidPayload("bidderId is missing or malformed");
    }
    if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw this.invalidPayload("amount must be positive");
    }

    await Auction.updateOne(
      { _id: data.auctionId },
      {
        $set: {
          currentBid: Number(data.amount),
          highestBidderId: data.bidderId
        }
      }
    );
    logger.debug(`Auction ${data.auctionId} currentBid=${data.amount}`);
  }

  async applyWinnerSelected(data) {
    if (!data || typeof data !== "object") {
      throw this.invalidPayload("event data must be an object");
    }
    if (typeof data.auctionId !== "string" || data.auctionId.length < 12) {
      throw this.invalidPayload("auctionId is missing or malformed on winner.selected");
    }
    if (typeof data.winningBidderId !== "string" || data.winningBidderId.length < 12) {
      throw this.invalidPayload("winningBidderId is missing or malformed on winner.selected");
    }
    if (!Number.isFinite(Number(data.finalPrice)) || Number(data.finalPrice) <= 0) {
      throw this.invalidPayload("finalPrice must be positive on winner.selected");
    }

    await Auction.updateOne(
      { _id: data.auctionId, status: { $in: ["ENDED", "PAYMENT_PENDING"] } },
      {
        $set: {
          winningBidderId: data.winningBidderId,
          finalPrice: Number(data.finalPrice),
          currentBid: Number(data.finalPrice),
          highestBidderId: data.winningBidderId
        }
      }
    );
    logger.info(`Auction ${data.auctionId} winner reassigned to ${data.winningBidderId}`);
  }

  async applyAuctionSold(data) {
    if (!data || typeof data.auctionId !== "string" || data.auctionId.length < 12) {
      throw this.invalidPayload("auctionId is required on auction.sold");
    }
    const updated = await Auction.findOneAndUpdate(
      { _id: data.auctionId, status: { $in: ["ENDED", "PAYMENT_PENDING"] } },
      { $set: { status: "SOLD", soldAt: new Date() } },
      { new: true }
    );
    if (updated) {
      logger.info(`Auction ${data.auctionId} -> SOLD`);
    }
  }

  async applyAuctionUnsold(data) {
    if (!data || typeof data.auctionId !== "string" || data.auctionId.length < 12) {
      throw this.invalidPayload("auctionId is required on auction.unsold");
    }
    const updated = await Auction.findOneAndUpdate(
      { _id: data.auctionId, status: "ENDED" },
      { $set: { status: "UNSOLD" } },
      { new: true }
    );
    if (updated) {
      logger.info(`Auction ${data.auctionId} -> UNSOLD after saga exhaustion`);
    }
  }

  buildHandler() {
    const HANDLERS = {
      [KAFKA_TOPICS.BID_PLACED]: "applyBidPlaced",
      [KAFKA_TOPICS.WINNER_SELECTED]: "applyWinnerSelected",
      [KAFKA_TOPICS.AUCTION_SOLD]: "applyAuctionSold",
      [KAFKA_TOPICS.AUCTION_UNSOLD]: "applyAuctionUnsold"
    };

    return createRetryingHandler({
      retries: this.retries,
      baseDelayMs: this.baseDelayMs,
      handle: async ({ topic, value }) => {
        const handlerName = HANDLERS[topic];
        if (!handlerName) {
          return;
        }
        let event;
        try {
          event = JSON.parse(value);
        } catch {
          const err = new Error("MalformedJSON");
          err.name = "MalformedMessageError";
          throw err;
        }
        await this[handlerName](event.data);
      },
      onPermanentFailure: async ({ topic, value, error, attempts }) => {
        await dlq.park({ originalTopic: topic, value, error, attempts });
      }
    });
  }

  async start() {
    if (this.consumer) {
      return;
    }
    const kafka = getKafka();
    this.consumer = kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        KAFKA_TOPICS.BID_PLACED,
        KAFKA_TOPICS.WINNER_SELECTED,
        KAFKA_TOPICS.AUCTION_SOLD,
        KAFKA_TOPICS.AUCTION_UNSOLD
      ],
      fromBeginning: true
    });

    await this.consumer.run({ eachMessage: this.buildHandler() });

    this.running = true;
    logger.info(`Bid consumer consuming as group '${this.groupId}'`);
  }

  async stop() {
    if (!this.consumer) {
      return;
    }
    this.running = false;
    try {
      await this.consumer.disconnect();
      logger.info("Bid consumer disconnected");
    } catch (err) {
      logger.error("Error disconnecting bid consumer:", err.message);
    }
    this.consumer = null;
  }
}

module.exports = { BidConsumer };

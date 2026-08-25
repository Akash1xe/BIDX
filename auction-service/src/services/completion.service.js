const { KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const logger = require("@bidx/shared/utils/logger");
const Auction = require("../models/auction.model");

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    logger.error(`Completion event publish failed for ${topic}: ${err.message}`);
  }
}

function hasWinner(auction) {
  return auction.currentBid > 0 && auction.highestBidderId;
}

async function publishCompletionEvents(auction) {
  const winner = hasWinner(auction);
  const payload = {
    auctionId: auction._id.toString(),
    endedAt: auction.endedAt instanceof Date ? auction.endedAt.toISOString() : auction.endedAt,
    outcome: winner ? "WINNER_PENDING_PAYMENT" : "NO_VALID_BID",
    finalPrice: auction.currentBid,
    winningBidderId: winner ? auction.highestBidderId.toString() : null,
    sellerId: auction.sellerId.toString()
  };

  await safePublish(KAFKA_TOPICS.AUCTION_ENDED, payload, payload.auctionId);

  if (winner) {
    await safePublish(
      KAFKA_TOPICS.WINNER_SELECTED,
      {
        auctionId: payload.auctionId,
        winningBidderId: payload.winningBidderId,
        sellerId: payload.sellerId,
        finalPrice: payload.finalPrice,
        paymentDeadlineHours: 48
      },
      payload.auctionId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "WINNER",
        userId: payload.winningBidderId,
        auctionId: payload.auctionId,
        finalPrice: payload.finalPrice
      },
      payload.winningBidderId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "SELLER_SOLD",
        userId: payload.sellerId,
        auctionId: payload.auctionId,
        finalPrice: payload.finalPrice
      },
      payload.sellerId
    );
  }

  return payload;
}

async function finalizeExpiredAuction(auction) {
  const winner = hasWinner(auction);
  const claimed = await Auction.findOneAndUpdate(
    { _id: auction._id, status: "LIVE" },
    {
      $set: {
        status: winner ? "ENDED" : "UNSOLD",
        endedAt: new Date(),
        winningBidderId: winner ? auction.highestBidderId : null,
        finalPrice: auction.currentBid
      }
    },
    { new: true }
  );

  if (!claimed) {
    // Another worker already finalized this auction - idempotent skip.
    return null;
  }

  logger.info(
    `Auction ${claimed._id.toString()} auto-completed -> ${claimed.status}${winner ? ` (winner ${payloadWinner(claimed)})` : ""}`
  );
  return publishCompletionEvents(claimed);
}

function payloadWinner(auction) {
  return auction.highestBidderId ? auction.highestBidderId.toString() : null;
}

module.exports = { hasWinner, publishCompletionEvents, finalizeExpiredAuction };

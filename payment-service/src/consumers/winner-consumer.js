const { KAFKA_TOPICS } = require("@bidx/shared");
const logger = require("@bidx/shared/utils/logger");
const { getKafka } = require("../config/kafka");
const { createRetryingHandler } = require("@bidx/shared/kafka/message-handler");
const dlq = require("@bidx/shared/kafka/dlq");
const db = require("../config/db");
const { auctionWinnerSchema } = require("../models/auction-winner.model");
const { paymentSchema } = require("../models/payment.model");

function invalid(message) {
  const err = new Error(`InvalidPayload: ${message}`);
  err.name = "InvalidPayloadError";
  return err;
}

class WinnerConsumer {
  constructor({ groupId, retries, baseDelayMs } = {}) {
    this.groupId = groupId || process.env.PAYMENT_WINNERS_GROUP_ID || "bidx-payment-winners";
    this.retries = retries || 3;
    this.baseDelayMs = baseDelayMs || 400;
    this.consumer = null;
    this.running = false;
  }

  get isConnected() {
    return this.running;
  }

  async applyWinner(data) {
    if (!data || typeof data !== "object") {
      throw invalid("event data must be an object");
    }
    if (typeof data.auctionId !== "string" || data.auctionId.length < 12) {
      throw invalid("auctionId is missing or malformed on winner.selected");
    }
    if (typeof data.winningBidderId !== "string" || data.winningBidderId.length < 12) {
      throw invalid("winningBidderId is missing or malformed on winner.selected");
    }
    if (!Number.isFinite(Number(data.finalPrice)) || Number(data.finalPrice) <= 0) {
      throw invalid("finalPrice must be a positive number on winner.selected");
    }

    const AuctionWinner = auctionWinnerSchema(db.get("payments"));
    await AuctionWinner.updateOne(
      { auctionId: data.auctionId },
      {
        $set: {
          auctionId: data.auctionId,
          winnerId: data.winningBidderId,
          sellerId: String(data.sellerId),
          finalPrice: Number(data.finalPrice),
          outcome: "WINNER_PENDING_PAYMENT",
          endedAt: new Date()
        }
      },
      { upsert: true }
    );

    const Payment = paymentSchema(db.get("payments"));
    await Payment.updateMany(
      { auctionId: data.auctionId, status: "CREATED", winnerId: { $ne: data.winningBidderId } },
      { $set: { status: "FAILED" } }
    );

    logger.debug(`Winner recorded for ${data.auctionId} -> ${data.winningBidderId}`);
  }

  buildHandler() {
    return createRetryingHandler({
      retries: this.retries,
      baseDelayMs: this.baseDelayMs,
      handle: async ({ topic, value }) => {
        if (topic !== KAFKA_TOPICS.WINNER_SELECTED) {
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
        await this.applyWinner(event.data);
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
      topics: [KAFKA_TOPICS.WINNER_SELECTED],
      fromBeginning: true
    });

    await this.consumer.run({ eachMessage: this.buildHandler() });

    this.running = true;
    logger.info(`Winner consumer consuming as group '${this.groupId}'`);
  }

  async stop() {
    if (!this.consumer) {
      return;
    }
    this.running = false;
    try {
      await this.consumer.disconnect();
      logger.info("Winner consumer disconnected");
    } catch (err) {
      logger.error("Error disconnecting winner consumer:", err.message);
    }
    this.consumer = null;
  }
}

module.exports = { WinnerConsumer };

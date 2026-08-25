const { KAFKA_TOPICS } = require("@bidx/shared");
const env = require("../config/env");
const logger = require("@bidx/shared/utils/logger");
const { getKafka } = require("../config/kafka");
const { createRetryingHandler } = require("@bidx/shared/kafka/message-handler");
const dlq = require("@bidx/shared/kafka/dlq");

const TOPIC_HANDLERS = {
  [KAFKA_TOPICS.AUCTION_CREATED]: "applyCreated",
  [KAFKA_TOPICS.AUCTION_UPDATED]: "applyUpdated",
  [KAFKA_TOPICS.AUCTION_STARTED]: "applyStarted",
  [KAFKA_TOPICS.AUCTION_ENDED]: "applyEnded",
  [KAFKA_TOPICS.AUCTION_DELETED]: "applyDeleted",
  [KAFKA_TOPICS.WINNER_SELECTED]: "applyWinnerSelected",
  [KAFKA_TOPICS.AUCTION_SOLD]: "applyAuctionSold",
  [KAFKA_TOPICS.AUCTION_UNSOLD]: "applyAuctionUnsold"
};

class AuctionIndexerConsumer {
  constructor(indexerService, { retries, baseDelayMs } = {}) {
    this.indexer = indexerService;
    this.retries = retries || 3;
    this.baseDelayMs = baseDelayMs || 400;
    this.consumer = null;
    this.running = false;
  }

  get isConnected() {
    return this.running;
  }

  buildHandler() {
    return createRetryingHandler({
      retries: this.retries,
      baseDelayMs: this.baseDelayMs,
      handle: async ({ topic, value }) => {
        const handlerName = TOPIC_HANDLERS[topic];
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
        await this.indexer[handlerName](event.data);
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
      groupId: env.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: Object.keys(TOPIC_HANDLERS),
      fromBeginning: true
    });

    await this.consumer.run({ eachMessage: this.buildHandler() });

    this.running = true;
    logger.info(
      `Auction indexer consuming as group '${env.kafka.groupId}' (retries=${this.retries}, backoff=${this.baseDelayMs}ms)`
    );
  }

  async stop() {
    if (!this.consumer) {
      return;
    }
    this.running = false;
    try {
      await this.consumer.disconnect();
      logger.info("Auction indexer disconnected");
    } catch (err) {
      logger.error("Error disconnecting indexer:", err.message);
    }
    this.consumer = null;
  }
}

module.exports = { AuctionIndexerConsumer };

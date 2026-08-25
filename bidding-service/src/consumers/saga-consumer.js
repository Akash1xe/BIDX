const { KAFKA_TOPICS } = require("@bidx/shared");
const logger = require("@bidx/shared/utils/logger");
const { getKafka } = require("../config/kafka");
const { createRetryingHandler } = require("@bidx/shared/kafka/message-handler");
const dlq = require("@bidx/shared/kafka/dlq");

function invalid(message) {
  const err = new Error(`InvalidPayload: ${message}`);
  err.name = "InvalidPayloadError";
  return err;
}

function assertBase(data, topic) {
  if (!data || typeof data !== "object") {
    throw invalid("event data must be an object");
  }
  if (typeof data.auctionId !== "string" || data.auctionId.length < 12) {
    throw invalid(`auctionId is missing or malformed on ${topic}`);
  }
}

class SagaConsumer {
  constructor({ sagaService, groupId, retries, baseDelayMs } = {}) {
    this.sagaService = sagaService;
    this.groupId = groupId || process.env.SAGA_GROUP_ID || "bidx-saga-orchestrator";
    this.retries = retries || 3;
    this.baseDelayMs = baseDelayMs || 400;
    this.consumer = null;
    this.running = false;
  }

  get isConnected() {
    return this.running;
  }

  async applyEvent(topic, data) {
    assertBase(data, topic);
    switch (topic) {
      case KAFKA_TOPICS.WINNER_SELECTED:
        if (
          typeof data.winningBidderId !== "string" ||
          data.winningBidderId.length < 12 ||
          !Number.isFinite(Number(data.finalPrice))
        ) {
          throw invalid("winningBidderId/finalPrice invalid on winner.selected");
        }
        await this.sagaService.onWinnerSelected(data);
        break;
      case KAFKA_TOPICS.PAYMENT_SUCCESS:
        if (typeof data.winnerId !== "string") {
          throw invalid("winnerId is required on payment.success");
        }
        await this.sagaService.onPaymentSuccess(data);
        break;
      case KAFKA_TOPICS.PAYMENT_FAILED:
        await this.sagaService.onPaymentFailed(data);
        break;
      default:
        break;
    }
  }

  buildHandler() {
    return createRetryingHandler({
      retries: this.retries,
      baseDelayMs: this.baseDelayMs,
      handle: async ({ topic, value }) => {
        const handled = [
          KAFKA_TOPICS.WINNER_SELECTED,
          KAFKA_TOPICS.PAYMENT_SUCCESS,
          KAFKA_TOPICS.PAYMENT_FAILED
        ];
        if (!handled.includes(topic)) {
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
        await this.applyEvent(topic, event.data);
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
      topics: [KAFKA_TOPICS.WINNER_SELECTED, KAFKA_TOPICS.PAYMENT_SUCCESS, KAFKA_TOPICS.PAYMENT_FAILED],
      fromBeginning: true
    });

    await this.consumer.run({ eachMessage: this.buildHandler() });

    this.running = true;
    logger.info(`Saga orchestrator consuming as group '${this.groupId}'`);
  }

  async stop() {
    if (!this.consumer) {
      return;
    }
    this.running = false;
    try {
      await this.consumer.disconnect();
      logger.info("Saga orchestrator disconnected");
    } catch (err) {
      logger.error("Error disconnecting saga orchestrator:", err.message);
    }
    this.consumer = null;
  }
}

module.exports = { SagaConsumer };

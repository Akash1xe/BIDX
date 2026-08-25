const crypto = require("crypto");
const publisher = require("./producer");
const logger = require("../utils/logger");

function safeParse(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch {
    return { raw: String(rawValue).slice(0, 2000) };
  }
}

class DeadLetterQueue {
  constructor() {
    this.counts = {};
    this.failedParks = 0;
  }

  topicFor(originalTopic) {
    return `${originalTopic}.dlq`;
  }

  async park({ originalTopic, value, error, attempts }) {
    const dlqTopic = this.topicFor(originalTopic);
    const payload = {
      originalTopic,
      originalPayload: safeParse(value),
      errorMessage: error ? error.message : "unknown",
      errorType: error ? error.name : "Error",
      attempts
    };

    const published = await publisher.publish(dlqTopic, payload, {
      key: payload.originalPayload && payload.originalPayload.auctionId ? String(payload.originalPayload.auctionId) : null,
      headers: {
        "x-original-topic": originalTopic,
        "x-attempts": String(attempts),
        "x-error-type": payload.errorType
      }
    });

    if (published) {
      this.counts[originalTopic] = (this.counts[originalTopic] || 0) + 1;
      logger.warn(`Message parked on ${dlqTopic} after ${attempts} attempts: ${payload.errorMessage}`);
    } else {
      this.failedParks += 1;
      logger.error(`Could not publish to ${dlqTopic}; message dropped. Original: ${payload.errorMessage}`);
    }
    return published;
  }

  stats() {
    return {
      total: Object.values(this.counts).reduce((sum, n) => sum + n, 0),
      failedParks: this.failedParks,
      byTopic: { ...this.counts }
    };
  }
}

module.exports = new DeadLetterQueue();

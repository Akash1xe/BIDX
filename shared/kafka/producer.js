const crypto = require("crypto");
const { Kafka } = require("kafkajs");
const logger = require("../utils/logger");

class EventPublisher {
  constructor() {
    if (EventPublisher.instance) {
      return EventPublisher.instance;
    }
    this.kafka = null;
    this.producer = null;
    this.connectPromise = null;
    this.connected = false;
    EventPublisher.instance = this;
  }

  async init({ brokers, clientId }) {
    if (this.producer) {
      return this.producer;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: { initialRetryTime: 300, retries: 5 }
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
    this.producer.on(this.producer.events.CONNECT, () => {
      this.connected = true;
    });
    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connected = false;
    });
    this.connectPromise = this.producer
      .connect()
      .then(() => {
        logger.info("Kafka producer connected");
        return this.producer;
      })
      .catch((err) => {
        logger.error("Kafka producer connect failed:", err.message);
        this.producer = null;
        this.connectPromise = null;
        this.connected = false;
        throw err;
      });
    return this.connectPromise;
  }

  get isConnected() {
    return Boolean(this.connected);
  }

  async publish(topic, data, { key = null, source = undefined, headers = {} } = {}) {
    if (!this.producer) {
      logger.warn(`Kafka producer not initialized, dropping event on topic ${topic}`);
      return false;
    }
    const message = {
      eventId: crypto.randomUUID(),
      eventType: topic,
      occurredAt: new Date().toISOString(),
      source: source || process.env.SERVICE_NAME || "bidx",
      version: 1,
      data
    };
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key,
            value: JSON.stringify(message),
            headers: {
              "event-id": message.eventId,
              "event-type": topic,
              ...headers
            }
          }
        ]
      });
      logger.info(`Event published: ${topic} (${message.eventId})`);
      return true;
    } catch (err) {
      logger.error(`Failed to publish event on ${topic}:`, err.message);
      return false;
    }
  }

  async disconnect() {
    if (!this.producer) {
      return;
    }
    try {
      await this.producer.disconnect();
      logger.info("Kafka producer disconnected");
    } catch (err) {
      logger.error("Error disconnecting Kafka producer:", err.message);
    }
    this.connected = false;
    this.producer = null;
    this.connectPromise = null;
  }
}

module.exports = new EventPublisher();

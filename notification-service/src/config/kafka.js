const { Kafka } = require("kafkajs");
const logger = require("@bidx/shared/utils/logger");
const env = require("./env");

let kafka = null;

function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: env.kafka.clientId,
      brokers: env.kafka.brokers
    });
  }
  return kafka;
}

module.exports = { getKafka };

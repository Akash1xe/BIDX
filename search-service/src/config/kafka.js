const { Kafka } = require("kafkajs");
const env = require("./env");

let kafkaInstance = null;

function getKafka() {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: env.kafka.clientId,
      brokers: env.kafka.brokers,
      retry: { initialRetryTime: 300, retries: 5 }
    });
  }
  return kafkaInstance;
}

module.exports = { getKafka };

const { Kafka } = require("kafkajs");
const env = require("./env");

let client = null;

function getKafka() {
  if (!client) {
    client = new Kafka({
      clientId: env.kafka.clientId,
      brokers: env.kafka.brokers,
      logLevel: 1,
      retry: { initialRetryTime: 300, retries: 5 }
    });
  }
  return client;
}

module.exports = { getKafka };

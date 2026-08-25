const { KAFKA_TOPICS } = require("@bidx/shared");
const logger = require("@bidx/shared/utils/logger");
const { getKafka } = require("../config/kafka");
const notificationService = require("../services/notification.service");
const env = require("../config/env");

let consumer = null;

async function start() {
  const kafka = getKafka();
  consumer = kafka.consumer({ groupId: env.kafka.groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPICS.NOTIFICATION_EMAIL, fromBeginning: false });
  logger.info(`Email consumer consuming as group '${env.kafka.groupId}'`);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const envelope = JSON.parse(message.value.toString());
        const data = envelope.data || {};
        const event = {
          eventId: envelope.eventId,
          occurredAt: envelope.occurredAt,
          ...data
        };
        await notificationService.processEmail(event);
      } catch (err) {
        logger.error(`Email consumer error: ${err.message}`);
      }
    }
  });
}

async function stop() {
  if (consumer) {
    try { await consumer.disconnect(); } catch {}
  }
}

module.exports = { start, stop };

const crypto = require("crypto");
process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";
const { Kafka } = require("kafkajs");

function envelope(topic, data) {
  return {
    eventId: crypto.randomUUID(),
    eventType: topic,
    occurredAt: new Date().toISOString(),
    source: process.env.SERVICE_NAME || "bidx-injector",
    version: 1,
    data
  };
}

async function main() {
  const topic = process.argv[2];
  const key = process.argv[3] || null;
  let data;
  try {
    data = JSON.parse(process.argv[4]);
  } catch {
    console.error("usage: node scripts/inject-event.js <topic> <key|null> '<json-data>'");
    process.exit(1);
  }

  if (!topic) {
    console.error("usage: node scripts/inject-event.js <topic> <key|null> '<json-data>'");
    process.exit(1);
  }

  const kafka = new Kafka({ clientId: "bidx-event-injector", brokers: ["localhost:9092"] });
  const producer = kafka.producer({ allowAutoTopicCreation: true });

  await producer.connect();
  await producer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify(envelope(topic, data)),
        headers: { "event-type": topic, "injected": "true" }
      }
    ]
  });
  await producer.disconnect();
  console.log(`injected event on ${topic}`);
}

main().catch((err) => {
  console.error("inject failed:", err.message);
  process.exit(1);
});

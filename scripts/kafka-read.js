const { Kafka } = require("kafkajs");
const topic = process.argv[2];
const timeoutMs = Number(process.argv[3]) || 10000;
if (!topic) { process.exit(1); }

async function main() {
  const kafka = new Kafka({ clientId: "kafka-read-helper", brokers: ["localhost:9092"], logLevel: 5 });
  const groupId = `kafka-read-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const consumer = kafka.consumer({ groupId, sessionTimeout: 30000 });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  const messages = [];
  let resolved = false;
  const done = new Promise((resolve) => {
    setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      try { await consumer.stop(); } catch {}
      try { await consumer.disconnect(); } catch {}
      for (const m of messages) {
        process.stdout.write(JSON.stringify(m) + "\n");
      }
      resolve();
    }, timeoutMs);
  });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (resolved) return;
      try {
        messages.push(JSON.parse(message.value.toString()));
      } catch {}
    }
  });
  await done;
}
main().catch(() => process.exit(1));

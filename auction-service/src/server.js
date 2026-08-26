const env = require("./config/env");
const db = require("./config/db");
const publisher = require("@bidx/shared/kafka/producer");
const { createApp } = require("./app");
const logger = require("@bidx/shared/utils/logger");
const { BidConsumer } = require("./consumers/bid-consumer");
const { CompletionScheduler } = require("./jobs/completion.scheduler");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;
  await db.connect(env.mongoUri);

  if (!env.demoMode) {
    publisher
      .init({ brokers: env.kafka.brokers, clientId: env.kafka.clientId })
      .catch(() => {
        logger.warn("Kafka unavailable at startup, events will be dropped until reconnected");
      });
  } else {
    logger.info("Demo mode enabled: Kafka producer and bid consumer are disabled");
  }

  const bidConsumer = new BidConsumer();
  const scheduler = new CompletionScheduler();

  if (!env.demoMode) {
    await bidConsumer.start().catch((err) => {
      logger.warn(`Bid consumer failed to start: ${err.message}`);
    });
  }
  scheduler.start();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`auction-service listening on port ${env.port} [${env.nodeEnv}]`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {});
    try {
      scheduler.stop();
      await bidConsumer.stop();
      await publisher.disconnect();
      await db.disconnect();
    } catch (err) {
      logger.error("Error during shutdown:", err.message);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception:", err.stack || err.message);
    shutdown("uncaughtException");
  });
}

main().catch((err) => {
  logger.error("Fatal startup error:", err.message);
  process.exit(1);
});

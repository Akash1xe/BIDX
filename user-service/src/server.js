const env = require("./config/env");
const db = require("./config/db");
const redis = require("@bidx/shared/redis/redis-client");
const publisher = require("@bidx/shared/kafka/producer");
const { createApp } = require("./app");
const { logger } = require("@bidx/shared");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;
  await db.connect(env.mongoUri);
  redis.init(env.redisUrl);

  if (!env.demoMode) {
    publisher
      .init({ brokers: env.kafka.brokers, clientId: env.kafka.clientId })
      .catch(() => {
        logger.warn("Kafka unavailable at startup, events will be dropped until reconnected");
      });
  } else {
    logger.info("Demo mode enabled: Kafka producer is disabled");
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`user-service listening on port ${env.port} [${env.nodeEnv}]`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {});
    try {
      await db.disconnect();
      await redis.quit();
      await publisher.disconnect();
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

const env = require("./config/env");
const db = require("./config/db");
const publisher = require("@bidx/shared/kafka/producer");
const { createApp } = require("./app");
const logger = require("@bidx/shared/utils/logger");
const { WinnerConsumer } = require("./consumers/winner-consumer");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;
  await db.connect("payments", env.mongoUri);

  let winnerConsumer = null;
  if (env.demoMode) {
    logger.info("DEMO_MODE enabled: Kafka payment events are disabled");
  } else {
    publisher
      .init({ brokers: env.kafka.brokers, clientId: env.kafka.clientId })
      .catch(() => {
        logger.warn("Kafka unavailable at startup, events will be dropped until reconnected");
      });

    winnerConsumer = new WinnerConsumer();
    await winnerConsumer.start().catch((err) => {
      logger.warn(`Winner consumer failed to start: ${err.message}`);
    });
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(
      `payment-service listening on port ${env.port} [${env.nodeEnv}] (gateway=${env.gateway.mode})`
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {});
    try {
      if (winnerConsumer) await winnerConsumer.stop();
      if (!env.demoMode) await publisher.disconnect();
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

const env = require("./config/env");
const db = require("./config/db");
const redisClient = require("@bidx/shared/redis/redis-client");
const publisher = require("@bidx/shared/kafka/producer");
const { initSocket } = require("./socket");
const emitter = require("./socket/emitter");
const logger = require("@bidx/shared/utils/logger");
const { createApp } = require("./app");
const { SagaConsumer } = require("./consumers/saga-consumer");
const { SagaService } = require("./services/saga.service");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;

  redisClient.init(env.redisUrl);

  await db.connect("bids", env.mongoUris.bids);
  await db.connect("auctions", env.mongoUris.auctions);

  publisher
    .init({ brokers: env.kafka.brokers, clientId: env.kafka.clientId })
    .catch(() => {
      logger.warn("Kafka unavailable at startup, events will be dropped until reconnected");
    });

  const sagaService = new SagaService();
  const sagaConsumer = new SagaConsumer({ sagaService });

  await sagaConsumer.start().catch((err) => {
    logger.warn(`Saga consumer failed to start: ${err.message}`);
  });

  let scanTimer = null;
  let scanning = false;
  scanTimer = setInterval(async () => {
    if (scanning) return;
    scanning = true;
    try {
      await sagaService.scanExpired();
    } catch (err) {
      logger.error(`Saga deadline scan failed: ${err.message}`);
    } finally {
      scanning = false;
    }
  }, env.saga.scanIntervalMs);
  scanTimer.unref();
  logger.info(`Saga deadline scanner started (interval=${env.saga.scanIntervalMs}ms)`);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`bidding-service listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const io = initSocket(server);
  emitter.setIo(io);
  logger.info("Socket.IO ready for real-time bid streams");

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    io.close();
    server.close(() => {});
    try {
      if (scanTimer) clearInterval(scanTimer);
      await sagaConsumer.stop();
      await publisher.disconnect();
      await redisClient.quit();
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

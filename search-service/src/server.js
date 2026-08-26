const env = require("./config/env");
const es = require("./config/elasticsearch");
const readiness = require("./config/readiness");
const publisher = require("@bidx/shared/kafka/producer");
const { ensureAuctionsIndex } = require("./indices/auctions.index");
const { IndexerService } = require("./services/indexer.service");
const { AuctionIndexerConsumer } = require("./consumers/auction-consumer");
const logger = require("@bidx/shared/utils/logger");
const { createApp } = require("./app");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElasticsearch() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    if (await es.ping()) {
      readiness.elasticsearchReady = true;
      logger.info("Elasticsearch is reachable");
      return true;
    }
    if (attempt % 5 === 0) {
      logger.warn(`Elasticsearch not reachable yet (attempt ${attempt}/30)`);
    }
    await sleep(2000);
  }
  logger.error("Elasticsearch unreachable after 30 attempts, giving up");
  return false;
}

async function main() {
  process.env.SERVICE_NAME = env.serviceName;

  if (!env.demoMode) {
    publisher
      .init({ brokers: env.kafka.brokers, clientId: `${env.kafka.clientId}-producer` })
      .catch(() => {
        logger.warn("Kafka producer unavailable at startup, DLQ parking will fail until connected");
      });
  } else {
    logger.info("Demo mode enabled: Elasticsearch and Kafka indexing are disabled");
  }

  const indexer = new IndexerService(es.inner);
  const consumer = new AuctionIndexerConsumer(indexer);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`search-service listening on port ${env.port} [${env.nodeEnv}]`);
  });

  // background bootstrap: ES index, then Kafka consumer
  if (!env.demoMode) (async () => {
    if (!(await waitForElasticsearch())) {
      return;
    }
    try {
      const result = await ensureAuctionsIndex(es.inner);
      readiness.indexReady = true;
      logger.info(`Auctions index ${result.created ? "created" : "verified"}`);
    } catch (err) {
      logger.error("Failed to ensure auctions index:", err.message);
      return;
    }
    try {
      await consumer.start();
      readiness.consumerRunning = true;
    } catch (err) {
      logger.error("Failed to start auction indexer:", err.message);
    }
  })();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {});
    try {
      await consumer.stop();
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

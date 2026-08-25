const env = require("./config/env");
const redis = require("@bidx/shared/redis/redis-client");
const { createApp } = require("./app");
const logger = require("@bidx/shared/utils/logger");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;
  redis.init(env.redisUrl);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`api-gateway listening on port ${env.port} [${env.nodeEnv}]`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {});
    try {
      await redis.quit();
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

const env = require("./config/env");
const redis = require("@bidx/shared/redis/redis-client");
const { createApp } = require("./app");
const logger = require("@bidx/shared/utils/logger");
const { proxySocketUpgrade } = require("./proxy/socket-proxy.service");

async function main() {
  process.env.SERVICE_NAME = env.serviceName;
  redis.init(env.redisUrl);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`api-gateway listening on port ${env.port} [${env.nodeEnv}]`);
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url, "http://gateway").pathname;
    if (!pathname.startsWith("/socket.io")) return socket.destroy();
    return proxySocketUpgrade(req, socket, head, env.services.bidding);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {});
    try { await redis.quit(); } catch (error) { logger.error("Error during shutdown:", error.message); }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => logger.error("Unhandled rejection:", reason));
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error.stack || error.message);
    shutdown("uncaughtException");
  });
}

main().catch((error) => {
  logger.error("Fatal startup error:", error.message);
  process.exit(1);
});

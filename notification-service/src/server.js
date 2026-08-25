const express = require("express");
const logger = require("@bidx/shared/utils/logger");
const env = require("./config/env");

process.env.SERVICE_NAME = "notification-service";
const { connect } = require("./config/db");
const notificationService = require("./services/notification.service");
const emailConsumer = require("./consumers/email-consumer");
const routes = require("./routes");
const errorHandler = require("./middleware/error-handler.middleware");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (req.path !== "/api/v1/health") {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

app.get("/api/v1/health", async (req, res) => {
  try {
    const stats = await notificationService.stats();
    res.json({
      success: true,
      data: {
        service: "notification-service",
        status: "healthy",
        mode: env.email.mode,
        ...stats,
        uptime: Math.floor(process.uptime())
      }
    });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

app.use("/api/v1/notifications", routes);
app.use(errorHandler);

async function startServer() {
  await connect();
  notificationService.init();
  await emailConsumer.start();
  app.listen(env.port, () => {
    logger.info(`notification-service listening on port ${env.port} [${env.nodeEnv}] (email=${env.email.mode})`);
  });
}

startServer().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  try { await emailConsumer.stop(); } catch {}
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled rejection: ${reason}`));

module.exports = app;

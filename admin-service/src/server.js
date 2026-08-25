const express = require("express");
const logger = require("@bidx/shared/utils/logger");
const env = require("./config/env");

process.env.SERVICE_NAME = "admin-service";
const db = require("./config/db");
const adminService = require("./services/admin.service");
const routes = require("./routes");
const errorHandler = require("./middleware/error-handler.middleware");

const app = express();
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: "admin-service",
      status: db.isConnected ? "healthy" : "degraded",
      uptime: Math.floor(process.uptime())
    }
  });
});

app.use("/api/v1/admin", routes);
app.use(errorHandler);

async function startServer() {
  for (const [name, uri] of Object.entries(env.mongo)) {
    await db.connect(name, uri);
  }
  adminService.init();
  app.listen(env.port, () => {
    logger.info(`admin-service listening on port ${env.port} [${env.nodeEnv}]`);
  });
}

startServer().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled rejection: ${reason}`));

module.exports = app;

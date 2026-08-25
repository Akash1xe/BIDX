const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const env = require("./config/env");
const { requestIdMiddleware } = require("./middleware/request-id.middleware");
const { loggerMiddleware } = require("./middleware/logger.middleware");
const { createRateLimiter } = require("./rate-limit/rate-limiter");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler.middleware");
const { gatewayHealth } = require("./controllers/health.controller");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestIdMiddleware);
  app.use(loggerMiddleware);

  const globalLimiter = createRateLimiter({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    keyPrefix: "global"
  });

  app.get("/health", gatewayHealth);
  app.use("/api/v1", globalLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

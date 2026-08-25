const express = require("express");
const routes = require("./routes");
const { healthCheck } = require("./controllers/health.controller");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler.middleware");
const { createRateLimiter } = require("./middleware/rate-limit.middleware");
const env = require("./config/env");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  const apiLimiter = createRateLimiter({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.apiMax,
    keyPrefix: "api"
  });

  app.get("/health", healthCheck);
  app.use("/api/v1", apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

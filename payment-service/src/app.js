const express = require("express");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler.middleware");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use("/api/v1/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

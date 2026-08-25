const { ApiResponse } = require("@bidx/shared");
const paymentService = require("../services/payment.service");

async function createOrder(req, res) {
  const data = await paymentService.createOrder(req.user, req.params.auctionId);
  return ApiResponse.success(res, { statusCode: 201, message: "Order created", data });
}

async function confirmCheckout(req, res) {
  const data = await paymentService.confirmCheckout(req.user, req.body || {});
  return ApiResponse.success(res, { statusCode: 200, message: "Payment confirmed", data });
}

async function webhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
  const result = await paymentService.handleWebhook(raw, req.headers["x-razorpay-signature"]);
  return ApiResponse.success(res, { statusCode: 200, message: "Webhook processed", data: result });
}

async function listMine(req, res) {
  const data = await paymentService.listMine(req.user.id, req.query);
  return ApiResponse.success(res, { message: "Payments fetched", data });
}

async function getByAuction(req, res) {
  const data = await paymentService.getByAuction(req.user, req.params.auctionId);
  return ApiResponse.success(res, { message: "Payment fetched", data });
}

async function healthCheck(req, res) {
  const env = require("../config/env");
  const db = require("../config/db");
  const publisher = require("@bidx/shared/kafka/producer");

  const mongodbConnected = db.isConnected;
  const kafkaConnected = publisher.isConnected;
  const healthy = mongodbConnected;

  return ApiResponse.success(res, {
    statusCode: healthy ? 200 : 503,
    message: healthy ? "Service healthy" : "Service degraded",
    data: {
      status: healthy ? "ok" : "degraded",
      service: env.serviceName,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        mongodb: { connected: mongodbConnected },
        kafka: { connected: kafkaConnected },
        gatewayMode: paymentService.gatewayMode
      }
    }
  });
}

module.exports = { createOrder, confirmCheckout, webhook, listMine, getByAuction, healthCheck };

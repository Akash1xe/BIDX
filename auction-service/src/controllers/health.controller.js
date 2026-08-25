const db = require("../config/db");
const publisher = require("@bidx/shared/kafka/producer");
const { ApiResponse } = require("@bidx/shared/utils/api-response");
const env = require("../config/env");

async function healthCheck(req, res) {
  const mongodbConnected = db.isConnected;
  const kafkaConnected = publisher.isConnected;

  const healthy = mongodbConnected && kafkaConnected;
  return ApiResponse.success(res, {
    statusCode: healthy ? 200 : 503,
    message: healthy ? "Service healthy" : "Service degraded",
    data: {
      status: healthy ? "ok" : "degraded",
      service: env.serviceName,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: { mongodb: { connected: mongodbConnected }, kafka: { connected: kafkaConnected } }
    }
  });
}

module.exports = { healthCheck };

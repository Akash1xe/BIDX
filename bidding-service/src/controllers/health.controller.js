const env = require("../config/env");
const db = require("../config/db");
const redisClient = require("@bidx/shared/redis/redis-client");
const publisher = require("@bidx/shared/kafka/producer");
const { ApiResponse } = require("@bidx/shared");

async function healthCheck(req, res) {
  let redisConnected = false;
  try {
    redisConnected = await redisClient.ping();
  } catch {
    redisConnected = false;
  }

  const mongodbConnected = db.isConnected;
  const kafkaConnected = publisher.isConnected;
  const healthy = mongodbConnected && redisConnected;

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
        redis: { connected: redisConnected },
        kafka: { connected: kafkaConnected }
      }
    }
  });
}

module.exports = { healthCheck };

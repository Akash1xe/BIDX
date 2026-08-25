const db = require("../config/db");
const redis = require("@bidx/shared/redis/redis-client");
const { ApiResponse } = require("@bidx/shared");
const env = require("../config/env");

async function healthCheck(req, res) {
  const mongodb = {
    connected: db.isConnected
  };

  let redisOk = false;
  if (redis.client) {
    try {
      redisOk = await Promise.race([
        redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis ping timeout")), 1000)
        )
      ]);
    } catch {
      redisOk = false;
    }
  }

  const healthy = mongodb.connected && redisOk;
  const body = {
    status: healthy ? "ok" : "degraded",
    service: env.serviceName,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      mongodb,
      redis: {
        ready: redisOk,
        status: redis.client ? redis.client.status : "not_initialized"
      }
    }
  };

  return ApiResponse.success(res, {
    statusCode: healthy ? 200 : 503,
    message: healthy ? "Service healthy" : "Service degraded",
    data: body
  });
}

module.exports = { healthCheck };

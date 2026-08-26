const env = require("../config/env");
const readiness = require("../config/readiness");
const es = require("../config/elasticsearch");
const publisher = require("@bidx/shared/kafka/producer");
const dlq = require("@bidx/shared/kafka/dlq");
const { ApiResponse } = require("@bidx/shared");

async function healthCheck(req, res) {
  if (env.demoMode) {
    return ApiResponse.success(res, {
      message: "Service healthy in demo mode",
      data: {
        status: "ok",
        service: env.serviceName,
        mode: "demo",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        services: {
          auctionFallback: { configured: Boolean(env.auctionServiceUrl) },
          elasticsearch: { connected: false, disabled: true },
          kafka: { connected: false, disabled: true }
        }
      }
    });
  }

  const elasticsearchConnected = await es.ping();
  const kafkaConnected = readiness.consumerRunning;
  const healthy = elasticsearchConnected && kafkaConnected;

  return ApiResponse.success(res, {
    statusCode: healthy ? 200 : 503,
    message: healthy ? "Service healthy" : "Service degraded",
    data: {
      status: healthy ? "ok" : "degraded",
      service: env.serviceName,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        elasticsearch: { connected: elasticsearchConnected },
        kafka: { connected: kafkaConnected, producerConnected: publisher.isConnected }
      },
      dlq: dlq.stats()
    }
  });
}

module.exports = { healthCheck };

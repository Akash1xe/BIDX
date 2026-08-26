const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "../../../.env")];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) { dotenv.config({ path: candidate }); break; }
}

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  logLevel: process.env.LOG_LEVEL || "info",
  serviceName: process.env.SERVICE_NAME || "bidding-service",
  port: parseInt(required("BIDDING_SERVICE_PORT", "4004"), 10),
  socketCorsOrigins: (process.env.CORS_ORIGINS || "*").split(",").map((value) => value.trim()),
  mongoUris: {
    bids: required("MONGODB_URI_BIDS", "mongodb://localhost:27017/bidx_bids"),
    auctions: required("MONGODB_URI_AUCTIONS", "mongodb://localhost:27017/bidx_auctions")
  },
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwt: { accessSecret: process.env.JWT_ACCESS_SECRET || (process.env.NODE_ENV !== "production" ? "dev-access-secret" : undefined) },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID_BIDDING || "bidx-bidding-service"
  },
  lock: {
    ttlMs: parseInt(process.env.BID_LOCK_TTL_MS || "5000", 10),
    acquireRetries: parseInt(process.env.BID_LOCK_RETRIES || "8", 10),
    retryDelayMs: parseInt(process.env.BID_LOCK_RETRY_DELAY_MS || "120", 10)
  },
  occMaxRetries: parseInt(process.env.BID_OCC_MAX_RETRIES || "3", 10),
  idempotencyTtlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || "600", 10),
  saga: {
    deadlineMs: parseInt(process.env.PAYMENT_DEADLINE_MS || String(48 * 3600 * 1000), 10),
    scanIntervalMs: parseInt(process.env.SAGA_SCAN_INTERVAL_MS || "5000", 10),
    groupId: process.env.SAGA_GROUP_ID || "bidx-saga-orchestrator"
  }
};

if (!env.jwt.accessSecret) throw new Error("JWT_ACCESS_SECRET is required in production");
if (env.isProduction && env.socketCorsOrigins.includes("*")) {
  throw new Error("CORS_ORIGINS must list exact frontend origins in production");
}

module.exports = env;

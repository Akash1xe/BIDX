const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "../../../.env")];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || "development";
const corsOrigins = (process.env.CORS_ORIGINS || "*").split(",").map((value) => value.trim());

const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  serviceName: process.env.SERVICE_NAME || "api-gateway",
  port: parseInt(process.env.PORT || required("GATEWAY_PORT", "4000"), 10),
  corsOrigins,
  authRefreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME || "bidx_refresh",
  jwt: { accessSecret: process.env.JWT_ACCESS_SECRET },
  rateLimit: {
    windowMs: parseInt(process.env.GATEWAY_RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.GATEWAY_RATE_LIMIT_MAX || "300", 10)
  },
  upstreamTimeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || "8000", 10),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  services: {
    user: required("USER_SERVICE_URL", "http://localhost:4001"),
    auction: required("AUCTION_SERVICE_URL", "http://localhost:4002"),
    search: required("SEARCH_SERVICE_URL", "http://localhost:4003"),
    bidding: required("BIDDING_SERVICE_URL", "http://localhost:4004"),
    payment: required("PAYMENT_SERVICE_URL", "http://localhost:4005"),
    notification: required("NOTIFICATION_SERVICE_URL", "http://localhost:4006"),
    admin: required("ADMIN_SERVICE_URL", "http://localhost:4007")
  },
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || "3", 10),
    openMs: parseInt(process.env.CIRCUIT_OPEN_MS || "10000", 10),
    halfOpenMaxProbes: parseInt(process.env.CIRCUIT_HALF_OPEN_PROBES || "1", 10)
  }
};

if (!env.isProduction && !env.jwt.accessSecret) env.jwt.accessSecret = "dev-access-secret";
if (!env.jwt.accessSecret) throw new Error("JWT_ACCESS_SECRET is required in production");
if (env.isProduction && env.corsOrigins.includes("*")) {
  throw new Error("CORS_ORIGINS must list exact frontend origins in production");
}

module.exports = env;

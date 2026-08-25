const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../.env")
];

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  logLevel: process.env.LOG_LEVEL || "info",
  serviceName: process.env.SERVICE_NAME || "user-service",

  port: parseInt(required("USER_SERVICE_PORT", "4001"), 10),

  mongoUri: required("MONGODB_URI_USERS", "mongodb://localhost:27017/bidx_users"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID
  },

  otp: {
    length: parseInt(process.env.OTP_LENGTH || "6", 10),
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || "300", 10),
    throttleSeconds: parseInt(process.env.OTP_THROTTLE_SECONDS || "60", 10),
    maxVerifyAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    verificationTtlSeconds: parseInt(process.env.OTP_VERIFICATION_TTL_SECONDS || "600", 10)
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    apiMax: parseInt(process.env.RATE_LIMIT_API_MAX || "100", 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10)
  },

  cache: {
    userProfileTtlSeconds: parseInt(process.env.CACHE_USER_TTL_SECONDS || "60", 10)
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID || "bidx-user-service"
  }
};

if (!env.isProduction && !env.jwt.accessSecret) {
  env.jwt.accessSecret = "dev-access-secret";
  env.jwt.refreshSecret = "dev-refresh-secret";
}

if (!env.jwt.accessSecret || !env.jwt.refreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production");
}

module.exports = env;

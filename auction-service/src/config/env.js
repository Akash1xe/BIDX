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
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  serviceName: process.env.SERVICE_NAME || "auction-service",

  port: parseInt(process.env.PORT || required("AUCTION_SERVICE_PORT", "4002"), 10),

  mongoUri: required("MONGODB_URI_AUCTIONS", "mongodb://localhost:27017/bidx_auctions"),

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID || "bidx-auction-service"
  }
};

module.exports = env;

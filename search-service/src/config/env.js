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
  serviceName: process.env.SERVICE_NAME || "search-service",

  port: parseInt(required("SEARCH_SERVICE_PORT", "4003"), 10),

  elasticsearch: {
    node: required("ELASTICSEARCH_NODE", "http://localhost:9200"),
    auctionsIndex: process.env.AUCTIONS_INDEX || "auctions"
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID_SEARCH || "bidx-search-service",
    groupId: process.env.SEARCH_INDEXER_GROUP_ID || "bidx-search-indexer"
  }
};

module.exports = env;

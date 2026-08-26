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

const hasLiveKeys = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  serviceName: process.env.SERVICE_NAME || "payment-service",

  port: parseInt(process.env.PORT || required("PAYMENT_SERVICE_PORT", "4005"), 10),

  mongoUri: required("MONGODB_URI_PAYMENTS", "mongodb://localhost:27017/bidx_payments"),

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID || "bidx-payment-service",
    winnersGroupId: process.env.PAYMENT_WINNERS_GROUP_ID || "bidx-payment-winners"
  },

  gateway: {
    mode: hasLiveKeys ? "live" : "dev",
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_bidx_dev",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "bidx-dev-key-secret",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "bidx-dev-webhook-secret",
    apiUrl: process.env.RAZORPAY_API_URL || "https://api.razorpay.com/v1"
  },

  orderTtlHours: parseInt(process.env.PAYMENT_ORDER_TTL_HOURS || "48", 10)
};

module.exports = env;

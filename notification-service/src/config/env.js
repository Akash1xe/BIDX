const env = {
  port: Number(process.env.NOTIFICATION_SERVICE_PORT) || 4006,
  nodeEnv: process.env.NODE_ENV || "development",
  mongo: {
    uri: process.env.MONGODB_URI_NOTIFICATIONS || "mongodb://localhost:27017/bidx_notifications"
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "notification-service",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    groupId: process.env.NOTIFICATION_GROUP_ID || "bidx-notification-emails"
  },
  email: {
    mode: process.env.EMAIL_MODE || "dev",
    sendgridApiKey: process.env.SENDGRID_API_KEY || "",
    fromAddress: process.env.EMAIL_FROM || "noreply@bidx.dev",
    fromName: process.env.EMAIL_FROM_NAME || "BidX"
  }
};

module.exports = env;

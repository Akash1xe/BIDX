const env = {
  port: Number(process.env.PORT || process.env.ADMIN_SERVICE_PORT) || 4007,
  nodeEnv: process.env.NODE_ENV || "development",
  mongo: {
    admin: process.env.MONGODB_URI_ADMIN || "mongodb://localhost:27017/bidx_admin",
    users: process.env.MONGODB_URI_USERS || "mongodb://localhost:27017/bidx_users",
    auctions: process.env.MONGODB_URI_AUCTIONS || "mongodb://localhost:27017/bidx_auctions",
    bids: process.env.MONGODB_URI_BIDS || "mongodb://localhost:27017/bidx_bids",
    payments: process.env.MONGODB_URI_PAYMENTS || "mongodb://localhost:27017/bidx_payments"
  }
};

module.exports = env;

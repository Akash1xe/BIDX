const mongoose = require("mongoose");
const logger = require("@bidx/shared/utils/logger");

class Database {
  constructor() {
    if (Database.instance) {
      return Database.instance;
    }
    this.initialized = false;
    Database.instance = this;
  }

  async connect(uri) {
    if (this.isConnected) {
      return mongoose.connection;
    }

    if (!this.initialized) {
      mongoose.set("strictQuery", true);
      mongoose.connection.on("connected", () => {
        logger.info("MongoDB connected:", mongoose.connection.name);
      });
      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected");
      });
      mongoose.connection.on("error", (err) => {
        logger.error("MongoDB error:", err.message);
      });
      this.initialized = true;
    }

    await mongoose.connect(uri);
    return mongoose.connection;
  }

  get isConnected() {
    return mongoose.connection.readyState === 1;
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }
    await mongoose.disconnect();
    logger.info("MongoDB connection closed");
  }
}

module.exports = new Database();

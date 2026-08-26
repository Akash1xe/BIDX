const mongoose = require("mongoose");
const logger = require("@bidx/shared/utils/logger");

class DbManager {
  constructor() {
    if (DbManager.instance) {
      return DbManager.instance;
    }
    this.connections = {};
    this.expected = 1;
    DbManager.instance = this;
  }

  async connect(name, uri) {
    if (this.connections[name]) {
      return this.connections[name];
    }
    const connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 10000 })
      .asPromise();
    this.connections[name] = connection;
    let host = "configured host";
    try { host = new URL(uri).host; } catch {}
    logger.info(`MongoDB [${name}] connected: ${host}`);
    return connection;
  }

  get(name) {
    const connection = this.connections[name];
    if (!connection) {
      throw new Error(`Database connection '${name}' not established`);
    }
    return connection;
  }

  get isConnected() {
    return (
      Object.keys(this.connections).length === this.expected &&
      Object.values(this.connections).every((c) => c.readyState === 1)
    );
  }

  async disconnect() {
    for (const [name, connection] of Object.entries(this.connections)) {
      try {
        await connection.close();
        logger.info(`MongoDB [${name}] disconnected`);
      } catch (err) {
        logger.error(`Error closing MongoDB [${name}]:`, err.message);
      }
    }
    this.connections = {};
  }
}

module.exports = new DbManager();

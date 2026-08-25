const mongoose = require("mongoose");
const logger = require("@bidx/shared/utils/logger");
const env = require("./env");

class DbManager {
  constructor() {
    if (DbManager.instance) return DbManager.instance;
    this.connections = {};
    this.expected = Object.keys(env.mongo).length;
    DbManager.instance = this;
  }

  async connect(name, uri) {
    if (this.connections[name]) return this.connections[name];
    const connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 10000 })
      .asPromise();
    this.connections[name] = connection;
    logger.info(`MongoDB [${name}] connected: ${uri.split("//")[1]}`);
    return connection;
  }

  get(name) {
    const connection = this.connections[name];
    if (!connection) throw new Error(`Database connection '${name}' not established`);
    return connection;
  }

  get isConnected() {
    return (
      Object.keys(this.connections).length === this.expected &&
      Object.values(this.connections).every((c) => c.readyState === 1)
    );
  }
}

module.exports = new DbManager();

const mongoose = require("mongoose");
const logger = require("@bidx/shared/utils/logger");
const env = require("./env");

let connection = null;

async function connect() {
  if (connection && connection.readyState === 1) return connection;
  connection = await mongoose
    .createConnection(env.mongo.uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    })
    .asPromise();
  logger.info(`MongoDB [notifications] connected: ${env.mongo.uri}`);
  return connection;
}

function getConnection() {
  if (!connection || connection.readyState !== 1) {
    throw new Error("MongoDB not connected");
  }
  return connection;
}

module.exports = { connect, getConnection };

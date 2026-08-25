const util = require("util");

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

function threshold() {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
}

function emit(stream, record) {
  stream.write(JSON.stringify(record) + "\n");
}

function write(level, args) {
  if (!LEVELS[level]) return;
  if (LEVELS[level] < threshold()) return;
  const record = {
    level: level.toUpperCase(),
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || "bidx",
    msg: util.format(...args)
  };
  if (level === "error") {
    emit(process.stderr, record);
  } else if (level === "warn") {
    emit(process.stderr, record);
  } else {
    emit(process.stdout, record);
  }
}

const logger = {
  debug: (...args) => write("debug", args),
  info: (...args) => write("info", args),
  warn: (...args) => write("warn", args),
  error: (...args) => write("error", args)
};

module.exports = logger;

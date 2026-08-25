const Redis = require("ioredis");
const { logger } = require("@bidx/shared");

class RedisClient {
  constructor() {
    if (RedisClient.instance) {
      return RedisClient.instance;
    }
    this.client = null;
    RedisClient.instance = this;
  }

  init(url, options = {}) {
    if (this.client) {
      return this.client;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 200, 5000);
      },
      ...options
    });
    this.client.on("connect", () => {
      logger.info("Redis connected");
    });
    this.client.on("ready", () => {
      logger.info("Redis ready");
    });
    this.client.on("error", (err) => {
      logger.error("Redis error:", err.message);
    });
    return this.client;
  }

  get isReady() {
    return this.client !== null && this.client.status === "ready";
  }

  async ping() {
    const reply = await this.client.ping();
    return reply === "PONG";
  }

  async get(key) {
    const value = await this.client.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async set(key, value, ttlSeconds = undefined) {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, serialized, "EX", ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(...keys) {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async quit() {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
    this.client = null;
    logger.info("Redis connection closed");
  }
}

module.exports = new RedisClient();

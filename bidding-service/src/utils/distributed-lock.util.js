const crypto = require("crypto");

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

class DistributedLock {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async acquire(key, ttlMs) {
    const token = crypto.randomUUID();
    const result = await this.redis.client.set(key, token, "PX", ttlMs, "NX");
    if (result !== "OK") {
      return null;
    }
    return { key, token };
  }

  async release(lock) {
    if (!lock) {
      return;
    }
    try {
      await this.redis.client.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
    } catch (err) {
      console.error(`Lock release failed for ${lock.key}: ${err.message}`);
    }
  }

  async withLock(key, ttlMs, fn) {
    const lock = await this.acquire(key, ttlMs);
    if (!lock) {
      return null;
    }
    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
}

module.exports = { DistributedLock };

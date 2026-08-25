const { ApiError } = require("@bidx/shared/errors/api-error");
const redis = require("@bidx/shared/redis/redis-client");

function createRateLimiter({ windowMs, max, keyPrefix }) {
  return async function rateLimiter(req, res, next) {
    const identifier = req.ip || "unknown";
    const windowStart = Math.floor(Date.now() / windowMs);
    const key = `rate:gateway:${keyPrefix}:${identifier}:${windowStart}`;

    try {
      const count = await redis.client.incr(key);
      if (count === 1) {
        await redis.client.pexpire(key, windowMs);
      }

      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - count));

      if (count > max) {
        const resetSeconds = Math.ceil(((windowStart + 1) * windowMs - Date.now()) / 1000);
        res.setHeader("Retry-After", Math.max(1, resetSeconds));
        throw ApiError.tooManyRequests("Too many requests, please slow down");
      }

      next();
    } catch (err) {
      if (err instanceof ApiError) {
        return next(err);
      }
      return next();
    }
  };
}

module.exports = { createRateLimiter };

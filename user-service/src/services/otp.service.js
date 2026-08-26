const crypto = require("crypto");
const { ApiError } = require("@bidx/shared");
const redis = require("@bidx/shared/redis/redis-client");
const env = require("../config/env");

const KEYS = {
  otp: (email) => `otp:${email}`,
  throttle: (email) => `otp:sent:${email}`,
  verified: (email) => `otp:verified:${email}`
};

function generateCode(length) {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, "0");
}

class OtpService {
  async sendOtp(email) {
    const throttled = await redis.get(KEYS.throttle(email));
    if (throttled) {
      throw ApiError.tooManyRequests("OTP already sent, please wait before requesting again");
    }

    const code = generateCode(env.otp.length);
    await redis.set(KEYS.otp(email), { code, attempts: 0 }, env.otp.ttlSeconds);
    await redis.set(KEYS.throttle(email), "1", env.otp.throttleSeconds);

    return {
      expiresInSeconds: env.otp.ttlSeconds,
      ...((env.isProduction && !env.demoMode) ? {} : { devOtp: code })
    };
  }

  async verifyOtp(email, code) {
    const record = await redis.get(KEYS.otp(email));
    if (!record || !record.code) {
      throw ApiError.badRequest("OTP expired or not requested");
    }

    if (record.code !== code) {
      const attempts = (record.attempts || 0) + 1;
      if (attempts >= env.otp.maxVerifyAttempts) {
        await redis.del(KEYS.otp(email));
        throw ApiError.badRequest("Too many invalid attempts, request a new OTP");
      }
      await redis.set(KEYS.otp(email), { ...record, attempts }, env.otp.ttlSeconds);
      throw ApiError.badRequest("Invalid OTP");
    }

    await redis.del(KEYS.otp(email));
    await redis.set(KEYS.verified(email), "1", env.otp.verificationTtlSeconds);
    return { verified: true };
  }

  async consumeVerification(email) {
    const marker = await redis.get(KEYS.verified(email));
    if (!marker) {
      return false;
    }
    await redis.del(KEYS.verified(email));
    return true;
  }
}

module.exports = new OtpService();

const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { ApiError, KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const env = require("../config/env");
const redis = require("@bidx/shared/redis/redis-client");
const otpService = require("./otp.service");
const tokenService = require("./token.service");
const userRepository = require("../repositories/user.repository");

const BCRYPT_ROUNDS = 10;
const googleClient = env.google.clientId ? new OAuth2Client(env.google.clientId) : null;

const CACHE_KEYS = {
  profile: (userId) => `cache:user:${userId}`
};

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    console.error(`Event publish failed for ${topic}: ${err.message}`);
  }
}

class UserService {
  async signup({ name, email, password }) {
    const verified = await otpService.consumeVerification(email);
    if (!verified) {
      throw ApiError.forbidden("Email is not verified, complete OTP verification first");
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userRepository.create({
      name,
      email,
      password: passwordHash,
      isVerified: true
    });

    await safePublish(
      KAFKA_TOPICS.USER_CREATED,
      { userId: user._id.toString(), email: user.email, name: user.name },
      user._id.toString()
    );

    const tokens = await tokenService.issueTokens(user);
    return { user: user.toPublicProfile(), tokens };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email, true);
    if (!user || !user.password) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (!user.isVerified) {
      throw ApiError.forbidden("Account is not verified, complete OTP verification");
    }

    if (user.isSuspended) {
      throw ApiError.forbidden("Account is suspended");
    }

    const tokens = await tokenService.issueTokens(user);
    return { user: user.toPublicProfile(), tokens };
  }

  async loginWithGoogle({ idToken }) {
    if (!googleClient) {
      throw ApiError.internal("Google authentication is not configured");
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.google.clientId
      });
      payload = ticket.getPayload();
    } catch {
      throw ApiError.unauthorized("Invalid Google identity token");
    }

    if (!payload.email || payload.email_verified === false) {
      throw ApiError.unauthorized("Google account has no verified email");
    }

    let user = await userRepository.findByGoogleId(payload.sub);
    let created = false;

    if (!user) {
      user = await userRepository.findByEmail(payload.email);
      if (user) {
        user = await userRepository.updateById(user._id, { googleId: payload.sub });
      } else {
        user = await userRepository.create({
          name: payload.name || payload.email.split("@")[0],
          email: payload.email,
          googleId: payload.sub,
          isVerified: true
        });
        created = true;
      }
    }

    if (created) {
      await safePublish(
        KAFKA_TOPICS.USER_CREATED,
        { userId: user._id.toString(), email: user.email, name: user.name },
        user._id.toString()
      );
    }

    const tokens = await tokenService.issueTokens(user);
    return { user: user.toPublicProfile(), tokens };
  }

  async getProfile(userId) {
    const cacheKey = CACHE_KEYS.profile(userId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { user: cached, fromCache: true };
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const profile = user.toPublicProfile();
    await redis.set(cacheKey, profile, env.cache.userProfileTtlSeconds);
    return { user: profile, fromCache: false };
  }

  async updateProfile(userId, updates) {
    const allowed = {};
    if (updates.name !== undefined) {
      allowed.name = updates.name;
    }
    if (Object.keys(allowed).length === 0) {
      throw ApiError.badRequest("No updatable fields provided");
    }

    const user = await userRepository.updateById(userId, allowed);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    await redis.del(CACHE_KEYS.profile(userId));
    await safePublish(
      KAFKA_TOPICS.USER_UPDATED,
      { userId: user._id.toString(), updatedFields: Object.keys(allowed) },
      user._id.toString()
    );

    return { user: user.toPublicProfile() };
  }
}

module.exports = new UserService();

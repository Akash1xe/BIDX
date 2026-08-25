const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ApiError } = require("@bidx/shared");
const env = require("../config/env");
const refreshTokenRepository = require("../repositories/refresh-token.repository");
const userRepository = require("../repositories/user.repository");

const ISSUER = "bidx.user-service";

function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(String(duration));
  if (!match) {
    return 15 * 60 * 1000;
  }
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1], 10) * multipliers[match[2]];
}

function hashJti(jti) {
  return crypto.createHash("sha256").update(jti).digest("hex");
}

class TokenService {
  signAccessToken(user) {
    return jwt.sign(
      { sub: user._id.toString(), email: user.email, role: user.role },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessExpiresIn, issuer: ISSUER }
    );
  }

  async signRefreshToken(user) {
    const jti = crypto.randomUUID();
    const ttlMs = parseDurationToMs(env.jwt.refreshExpiresIn);
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: hashJti(jti),
      expiresAt: new Date(Date.now() + ttlMs)
    });
    return jwt.sign({ sub: user._id.toString(), jti }, env.jwt.refreshSecret, {
      expiresIn: env.jwt.refreshExpiresIn,
      issuer: ISSUER
    });
  }

  async issueTokens(user) {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: env.jwt.accessExpiresIn,
      refreshTokenExpiresIn: env.jwt.refreshExpiresIn
    };
  }

  verifyAccessToken(token) {
    return jwt.verify(token, env.jwt.accessSecret, { issuer: ISSUER });
  }

  async rotateRefreshToken(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, env.jwt.refreshSecret, { issuer: ISSUER });
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const tokenHash = hashJti(payload.jti);
    const stored = await refreshTokenRepository.findByTokenHash(tokenHash);
    if (!stored) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    if (stored.revokedAt) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw ApiError.unauthorized(
        "Refresh token reuse detected, all sessions have been revoked"
      );
    }

    if (stored.expiresAt <= new Date()) {
      throw ApiError.unauthorized("Refresh token expired");
    }

    const user = await userRepository.findById(stored.userId);
    if (!user || user.isSuspended) {
      await refreshTokenRepository.revoke(stored.tokenHash);
      throw ApiError.unauthorized("Account unavailable");
    }

    await refreshTokenRepository.revoke(stored.tokenHash);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async logout(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, env.jwt.refreshSecret, { issuer: ISSUER });
      await refreshTokenRepository.revoke(hashJti(payload.jti));
    } catch {
      return;
    }
  }
}

module.exports = new TokenService();

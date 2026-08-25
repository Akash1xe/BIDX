const RefreshToken = require("../models/refresh-token.model");

class RefreshTokenRepository {
  create(data) {
    return RefreshToken.create(data);
  }

  findByTokenHash(tokenHash) {
    return RefreshToken.findOne({ tokenHash });
  }

  revoke(tokenHash) {
    return RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  revokeAllForUser(userId) {
    return RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }
}

module.exports = new RefreshTokenRepository();

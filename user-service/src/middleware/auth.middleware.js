const { ApiError } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const tokenService = require("../services/token.service");
const userRepository = require("../repositories/user.repository");

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired access token");
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.isSuspended) {
    throw ApiError.unauthorized("Account unavailable");
  }

  req.user = user.toPublicProfile();
  next();
});

module.exports = { requireAuth };

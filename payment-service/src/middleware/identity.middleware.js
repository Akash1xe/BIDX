const { ApiError } = require("@bidx/shared/errors/api-error");

function requireIdentity(req, res, next) {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") {
    throw ApiError.unauthorized("Authentication required");
  }
  req.user = {
    id: userId,
    email: req.headers["x-user-email"]
      ? decodeURIComponent(req.headers["x-user-email"])
      : undefined,
    role: req.headers["x-user-role"] || "USER"
  };
  next();
}

module.exports = { requireIdentity };

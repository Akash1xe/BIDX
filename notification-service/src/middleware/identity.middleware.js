const { ApiError } = require("@bidx/shared/errors/api-error");

function requireIdentity(req, _res, next) {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") throw ApiError.unauthorized("Authentication required");
  req.user = {
    id: userId,
    email: req.headers["x-user-email"] ? decodeURIComponent(req.headers["x-user-email"]) : undefined,
    role: req.headers["x-user-role"] || "USER"
  };
  next();
}

function requireAdmin(req, _res, next) {
  if (req.user.role !== "ADMIN") throw ApiError.forbidden("Admin access required");
  next();
}

module.exports = { requireIdentity, requireAdmin };

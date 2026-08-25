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

function optionalIdentity(req, res, next) {
  const userId = req.headers["x-user-id"];
  if (userId && typeof userId === "string") {
    req.user = {
      id: userId,
      role: req.headers["x-user-role"] || "USER"
    };
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }
    if (req.user.role !== role && req.user.role !== "ADMIN") {
      throw ApiError.forbidden(`Requires ${role} role`);
    }
    next();
  };
}

module.exports = { requireIdentity, optionalIdentity, requireRole };

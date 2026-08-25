const jwt = require("jsonwebtoken");
const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");

const IDENTITY_HEADERS = ["x-user-id", "x-user-email", "x-user-role"];

function clearIdentity(req) {
  for (const header of IDENTITY_HEADERS) {
    delete req.headers[header];
  }
}

function setIdentity(req, payload) {
  req.headers["x-user-id"] = payload.sub;
  req.headers["x-user-email"] = encodeURIComponent(payload.email || "");
  req.headers["x-user-role"] = payload.role || "";
  req.authUser = { id: payload.sub, email: payload.email, role: payload.role };
}

function verifyToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: "bidx.user-service" });
}

function gatewayAuth(routeConfig) {
  return function gatewayAuthMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = typeof header === "string" ? header.split(" ") : [];
    const hasToken = scheme === "Bearer" && token;

    if (routeConfig.auth) {
      if (!hasToken) {
        throw ApiError.unauthorized("Authentication required");
      }
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw ApiError.unauthorized("Invalid or expired access token");
      }
      clearIdentity(req);
      setIdentity(req, payload);
      return next();
    }

    clearIdentity(req);
    if (hasToken) {
      try {
        setIdentity(req, verifyToken(token));
      } catch {
        throw ApiError.unauthorized("Invalid or expired access token");
      }
    }
    next();
  };
}

module.exports = { gatewayAuth, IDENTITY_HEADERS };

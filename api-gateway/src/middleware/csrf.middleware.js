const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");

const COOKIE_AUTH_PATHS = new Set(["/api/v1/auth/refresh", "/api/v1/auth/logout"]);

function hasRefreshCookie(req) {
  const cookie = req.headers.cookie || "";
  return cookie.split(";").some((part) => part.trim().startsWith(`${env.authRefreshCookieName}=`));
}

function cookieCsrfGuard(req, _res, next) {
  if (req.method !== "POST" || !COOKIE_AUTH_PATHS.has(req.path) || !hasRefreshCookie(req)) {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin || !env.corsOrigins.includes(origin)) {
    throw ApiError.forbidden("Untrusted origin for cookie-authenticated request");
  }
  return next();
}

module.exports = { cookieCsrfGuard };

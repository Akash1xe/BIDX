const { ApiResponse, ApiError } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const otpService = require("../services/otp.service");
const tokenService = require("../services/token.service");
const userService = require("../services/user.service");
const env = require("../config/env");

function assertString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw ApiError.badRequest(`Field '${field}' is required`);
  return value.trim();
}

function assertPassword(value) {
  if (typeof value !== "string" || value.length < 8) throw ApiError.badRequest("Field 'password' must be at least 8 characters");
  return value;
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const name = part.slice(0, index).trim();
    try { cookies[name] = decodeURIComponent(part.slice(index + 1).trim()); } catch { cookies[name] = part.slice(index + 1).trim(); }
    return cookies;
  }, {});
}

function refreshTokenFromRequest(req, required = true) {
  const bodyToken = req.body?.refreshToken;
  const cookieToken = parseCookies(req.headers.cookie)[env.auth.refreshCookieName];
  const token = typeof bodyToken === "string" && bodyToken.trim() ? bodyToken.trim() : cookieToken;
  if (!token && required) throw ApiError.unauthorized("Refresh token required");
  return token;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.auth.refreshCookieSecure,
    sameSite: env.auth.refreshCookieSameSite,
    domain: env.auth.refreshCookieDomain,
    path: "/api/v1/auth",
    maxAge: env.auth.refreshCookieMaxAgeMs
  };
}

function commitSession(res, result) {
  res.cookie(env.auth.refreshCookieName, result.tokens.refreshToken, cookieOptions());
  if (env.auth.exposeRefreshTokenInBody) return result;
  const { refreshToken: _hidden, ...publicTokens } = result.tokens;
  return { ...result, tokens: publicTokens };
}

function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(env.auth.refreshCookieName, options);
}

const sendOtp = asyncHandler(async (req, res) => {
  const email = assertString(req.body.email, "email").toLowerCase();
  return ApiResponse.success(res, { message: `OTP sent to ${email}`, data: await otpService.sendOtp(email) });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const email = assertString(req.body.email, "email").toLowerCase();
  const otp = assertString(req.body.otp, "otp");
  return ApiResponse.success(res, { message: "Email verified", data: await otpService.verifyOtp(email, otp) });
});

const signup = asyncHandler(async (req, res) => {
  const result = await userService.signup({
    name: assertString(req.body.name, "name"),
    email: assertString(req.body.email, "email").toLowerCase(),
    password: assertPassword(req.body.password)
  });
  return ApiResponse.success(res, { statusCode: 201, message: "Account created", data: commitSession(res, result) });
});

const login = asyncHandler(async (req, res) => {
  const result = await userService.login({
    email: assertString(req.body.email, "email").toLowerCase(),
    password: assertString(req.body.password, "password")
  });
  return ApiResponse.success(res, { message: "Login successful", data: commitSession(res, result) });
});

const googleAuth = asyncHandler(async (req, res) => {
  const result = await userService.loginWithGoogle({ idToken: assertString(req.body.idToken, "idToken") });
  return ApiResponse.success(res, { message: "Google authentication successful", data: commitSession(res, result) });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await tokenService.rotateRefreshToken(refreshTokenFromRequest(req));
  return ApiResponse.success(res, { message: "Tokens rotated", data: commitSession(res, result) });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = refreshTokenFromRequest(req, false);
  if (refreshToken) await tokenService.logout(refreshToken);
  clearSessionCookie(res);
  return ApiResponse.success(res, { message: "Logged out" });
});

module.exports = { sendOtp, verifyOtp, signup, login, googleAuth, refresh, logout, parseCookies, refreshTokenFromRequest };

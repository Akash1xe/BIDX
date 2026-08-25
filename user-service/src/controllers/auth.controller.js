const { ApiResponse, ApiError } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const otpService = require("../services/otp.service");
const tokenService = require("../services/token.service");
const userService = require("../services/user.service");

function assertString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw ApiError.badRequest(`Field '${field}' is required`);
  }
  return value.trim();
}

function assertPassword(value) {
  if (typeof value !== "string" || value.length < 8) {
    throw ApiError.badRequest("Field 'password' must be at least 8 characters");
  }
  return value;
}

const sendOtp = asyncHandler(async (req, res) => {
  const email = assertString(req.body.email, "email").toLowerCase();
  const result = await otpService.sendOtp(email);
  return ApiResponse.success(res, {
    message: `OTP sent to ${email}`,
    data: result
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const email = assertString(req.body.email, "email").toLowerCase();
  const otp = assertString(req.body.otp, "otp");
  const result = await otpService.verifyOtp(email, otp);
  return ApiResponse.success(res, {
    message: "Email verified",
    data: result
  });
});

const signup = asyncHandler(async (req, res) => {
  const name = assertString(req.body.name, "name");
  const email = assertString(req.body.email, "email").toLowerCase();
  const password = assertPassword(req.body.password);

  const result = await userService.signup({ name, email, password });
  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Account created",
    data: result
  });
});

const login = asyncHandler(async (req, res) => {
  const email = assertString(req.body.email, "email").toLowerCase();
  const password = assertString(req.body.password, "password");
  const result = await userService.login({ email, password });
  return ApiResponse.success(res, {
    message: "Login successful",
    data: result
  });
});

const googleAuth = asyncHandler(async (req, res) => {
  const idToken = assertString(req.body.idToken, "idToken");
  const result = await userService.loginWithGoogle({ idToken });
  return ApiResponse.success(res, {
    message: "Google authentication successful",
    data: result
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = assertString(req.body.refreshToken, "refreshToken");
  const result = await tokenService.rotateRefreshToken(refreshToken);
  return ApiResponse.success(res, {
    message: "Tokens rotated",
    data: result
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (typeof refreshToken === "string" && refreshToken.trim() !== "") {
    await tokenService.logout(refreshToken.trim());
  }
  return ApiResponse.success(res, {
    message: "Logged out"
  });
});

module.exports = {
  sendOtp,
  verifyOtp,
  signup,
  login,
  googleAuth,
  refresh,
  logout
};

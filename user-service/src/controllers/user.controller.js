const { ApiResponse } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const userService = require("../services/user.service");

const getMe = asyncHandler(async (req, res) => {
  const result = await userService.getProfile(req.user.id);
  return ApiResponse.success(res, {
    message: "Profile fetched",
    data: result
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const result = await userService.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: "Profile updated",
    data: result
  });
});

module.exports = { getMe, updateMe };

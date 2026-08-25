const express = require("express");
const authController = require("../controllers/auth.controller");
const env = require("../config/env");
const { createRateLimiter } = require("../middleware/rate-limit.middleware");

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  keyPrefix: "auth"
});

router.post("/send-otp", authLimiter, authController.sendOtp);
router.post("/verify-otp", authLimiter, authController.verifyOtp);
router.post("/signup", authLimiter, authController.signup);
router.post("/login", authLimiter, authController.login);
router.post("/google", authLimiter, authController.googleAuth);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

module.exports = router;

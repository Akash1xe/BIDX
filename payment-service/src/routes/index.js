const express = require("express");
const { healthCheck } = require("../controllers/payment.controller");
const paymentController = require("../controllers/payment.controller");
const { requireIdentity } = require("../middleware/identity.middleware");
const { asyncHandler } = require("../utils/async-handler.util");

const router = express.Router();

router.get("/health", asyncHandler(healthCheck));
router.use("/health", asyncHandler(healthCheck));

router.post("/payments/webhook", asyncHandler(paymentController.webhook));
router.post("/payments/order/:auctionId", requireIdentity, asyncHandler(paymentController.createOrder));
router.post("/payments/confirm", requireIdentity, asyncHandler(paymentController.confirmCheckout));
router.get("/payments/mine", requireIdentity, asyncHandler(paymentController.listMine));
router.get("/payments/auction/:auctionId", requireIdentity, asyncHandler(paymentController.getByAuction));

module.exports = router;

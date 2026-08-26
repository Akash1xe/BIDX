const express = require("express");
const notificationService = require("../services/notification.service");
const asyncHandler = require("../utils/async-handler.util");
const { requireIdentity, requireAdmin } = require("../middleware/identity.middleware");

const router = express.Router();
router.use(requireIdentity);

router.get("/mine", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const items = await notificationService.listByUser(req.user.id, { limit, offset });
  res.json({ success: true, data: items });
}));

router.get("/auction/:auctionId", requireAdmin, asyncHandler(async (req, res) => {
  const items = await notificationService.listByAuction(req.params.auctionId);
  res.json({ success: true, data: items });
}));

router.get("/stats", requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await notificationService.stats() });
}));

module.exports = router;

const express = require("express");
const notificationService = require("../services/notification.service");
const asyncHandler = require("../utils/async-handler.util");

const router = express.Router();

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId || req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const items = await notificationService.listByUser(userId, { limit, offset });
    res.json({ success: true, data: items });
  })
);

router.get(
  "/auction/:auctionId",
  asyncHandler(async (req, res) => {
    const items = await notificationService.listByAuction(req.params.auctionId);
    res.json({ success: true, data: items });
  })
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const stats = await notificationService.stats();
    res.json({ success: true, data: stats });
  })
);

module.exports = router;

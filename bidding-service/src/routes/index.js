const express = require("express");
const { healthCheck } = require("../controllers/health.controller");
const bidController = require("../controllers/bid.controller");
const { requireIdentity } = require("../middleware/identity.middleware");
const { asyncHandler } = require("../utils/async-handler.util");

const router = express.Router();

router.get("/health", asyncHandler(healthCheck));
router.use("/health", asyncHandler(healthCheck));

router.post("/bids", requireIdentity, asyncHandler(bidController.placeBid));
router.get("/bids/mine", requireIdentity, asyncHandler(bidController.listMyBids));
router.get("/bids/auction/:auctionId", requireIdentity, asyncHandler(bidController.listAuctionBids));

module.exports = router;

const express = require("express");
const { healthCheck } = require("../controllers/health.controller");
const searchController = require("../controllers/search.controller");
const { asyncHandler } = require("../utils/async-handler.util");

const router = express.Router();

router.get("/health", asyncHandler(healthCheck));
router.use("/health", asyncHandler(healthCheck));
router.get("/search/health", asyncHandler(healthCheck));

router.get("/search/suggest", asyncHandler(searchController.suggestAuctions));
router.get("/search", asyncHandler(searchController.searchAuctions));

module.exports = router;

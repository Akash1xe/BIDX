const express = require("express");
const { gatewayHealth } = require("../controllers/health.controller");
const { proxyHandler } = require("../middleware/proxy.middleware");

const router = express.Router();

router.get("/health", gatewayHealth);
router.use("/health", gatewayHealth);

router.use(proxyHandler);

module.exports = router;

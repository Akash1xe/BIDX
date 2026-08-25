const express = require("express");
const controller = require("../controllers/admin.controller");
const { requireIdentity, requireAdmin } = require("../middleware/identity.middleware");

const router = express.Router();

router.use(requireIdentity, requireAdmin);

router.get("/users", controller.listUsers);
router.patch("/users/:id/suspend", controller.suspendUser);
router.get("/auctions", controller.listAuctions);
router.get("/stats", controller.stats);
router.get("/audit", controller.listAudit);

module.exports = router;

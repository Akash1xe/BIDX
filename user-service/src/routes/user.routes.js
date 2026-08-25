const express = require("express");
const userController = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use("/me", requireAuth);
router.get("/me", userController.getMe);
router.put("/me", userController.updateMe);

module.exports = router;

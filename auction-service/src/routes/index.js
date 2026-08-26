const express = require("express");
const { healthCheck } = require("../controllers/health.controller");
const { requireIdentity, optionalIdentity } = require("../middleware/identity.middleware");
const productController = require("../controllers/product.controller");
const auctionController = require("../controllers/auction.controller");
const { asyncHandler } = require("../utils/async-handler.util");

const router = express.Router();

router.get("/health", asyncHandler(healthCheck));
router.use("/health", asyncHandler(healthCheck));

router.post("/products", optionalIdentity, productController.createProduct);
router.get("/products/mine", requireIdentity, productController.listMyProducts);
router.get("/products/:productId", optionalIdentity, productController.getProduct);
router.delete("/products/:productId", requireIdentity, productController.deleteProduct);

router.get("/auctions", auctionController.listAuctions);
router.get("/auctions/:auctionId/history", auctionController.auctionHistory);
router.get("/auctions/:auctionId", auctionController.getAuction);
router.post("/auctions", optionalIdentity, auctionController.createAuction);
router.put("/auctions/:auctionId", optionalIdentity, auctionController.updateAuction);
router.delete("/auctions/:auctionId", optionalIdentity, auctionController.deleteAuction);
router.post("/auctions/:auctionId/start", optionalIdentity, auctionController.startAuction);
router.post("/auctions/:auctionId/end", optionalIdentity, auctionController.endAuction);

module.exports = router;

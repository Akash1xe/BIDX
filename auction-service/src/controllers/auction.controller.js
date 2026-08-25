const { ApiResponse, ApiError } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const auctionService = require("../services/auction.service");

function requireSeller(req) {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }
  if (req.user.role !== "SELLER" && req.user.role !== "ADMIN") {
    throw ApiError.forbidden("Requires SELLER role");
  }
}

const createAuction = asyncHandler(async (req, res) => {
  requireSeller(req);
  const { productId, startingPrice, minimumIncrement, startTime, endTime } = req.body;
  for (const field of ["productId", "startingPrice", "minimumIncrement", "startTime", "endTime"]) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === "") {
      throw ApiError.badRequest(`Field '${field}' is required`);
    }
  }
  const auction = await auctionService.create({
    sellerId: req.user.id,
    productId,
    startingPrice,
    minimumIncrement,
    startTime,
    endTime
  });
  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Auction created",
    data: auction
  });
});

const getAuction = asyncHandler(async (req, res) => {
  const auction = await auctionService.getById(req.params.auctionId);
  return ApiResponse.success(res, { message: "Auction fetched", data: auction });
});

const listAuctions = asyncHandler(async (req, res) => {
  const result = await auctionService.list({
    status: req.query.status,
    sellerId: req.query.sellerId,
    category: req.query.category,
    page: req.query.page,
    limit: req.query.limit
  });
  return ApiResponse.success(res, { message: "Auctions fetched", data: result });
});

const updateAuction = asyncHandler(async (req, res) => {
  requireSeller(req);
  const auction = await auctionService.update(
    req.params.auctionId,
    req.user.id,
    req.body
  );
  return ApiResponse.success(res, { message: "Auction updated", data: auction });
});

const deleteAuction = asyncHandler(async (req, res) => {
  requireSeller(req);
  const result = await auctionService.remove(req.params.auctionId, req.user.id);
  return ApiResponse.success(res, { message: "Auction deleted", data: result });
});

const startAuction = asyncHandler(async (req, res) => {
  requireSeller(req);
  const auction = await auctionService.start(req.params.auctionId, req.user.id);
  return ApiResponse.success(res, { message: "Auction started", data: auction });
});

const endAuction = asyncHandler(async (req, res) => {
  requireSeller(req);
  const auction = await auctionService.end(req.params.auctionId, req.user.id);
  return ApiResponse.success(res, { message: "Auction ended", data: auction });
});

const auctionHistory = asyncHandler(async (req, res) => {
  const result = await auctionService.history(req.params.auctionId);
  return ApiResponse.success(res, { message: "History placeholder", data: result });
});

module.exports = {
  createAuction,
  getAuction,
  listAuctions,
  updateAuction,
  deleteAuction,
  startAuction,
  endAuction,
  auctionHistory
};

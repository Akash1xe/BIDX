const { ApiResponse } = require("@bidx/shared");
const bidService = require("../services/bid.service");

async function placeBid(req, res) {
  const { auctionId, amount } = req.body || {};
  if (!auctionId || !amount) {
    const { ApiError } = require("@bidx/shared");
    throw ApiError.badRequest("auctionId and amount are required");
  }

  const idempotencyKey = req.headers["idempotency-key"];
  const result = await bidService.place({
    auctionId,
    bidderId: req.user.id,
    amount: Number(amount),
    idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined
  });

  return ApiResponse.success(res, {
    statusCode: result.replayed ? 200 : 201,
    message: result.replayed ? "Bid replayed (idempotent)" : "Bid accepted",
    data: result
  });
}

async function listAuctionBids(req, res) {
  const data = await bidService.listForAuction(req.user, req.params.auctionId, req.query);
  return ApiResponse.success(res, { statusCode: 200, message: "Bid history", data });
}

async function listMyBids(req, res) {
  const data = await bidService.listMine(req.user.id, req.query);
  return ApiResponse.success(res, { statusCode: 200, message: "Your bids", data });
}

module.exports = { placeBid, listAuctionBids, listMyBids };

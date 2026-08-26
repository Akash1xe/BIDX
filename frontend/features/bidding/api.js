import { api } from "@/services/api-client";

export const biddingApi = {
  placeBid({ auctionId, amount, idempotencyKey }) {
    return api.post("/bids", { auctionId, amount }, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },

  listAuctionBids(auctionId, params = {}) {
    return api.get(`/bids/auction/${auctionId}`, { params });
  },

  listMyBids(params = {}) {
    return api.get("/bids/mine", { params });
  },
};


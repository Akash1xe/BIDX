import { api } from "@/services/api-client";

export const auctionsApi = {
  list(params = {}) {
    return api.get("/auctions", { params });
  },

  getById(auctionId) {
    return api.get(`/auctions/${auctionId}`);
  },
};


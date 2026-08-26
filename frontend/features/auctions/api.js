import { api } from "@/services/api-client";

export const auctionsApi = {
  list(params = {}) {
    return api.get("/auctions", { params });
  },

  getById(auctionId) {
    return api.get(`/auctions/${auctionId}`);
  },

  create(payload) {
    return api.post("/auctions", payload);
  },

  update(auctionId, payload) {
    return api.put(`/auctions/${auctionId}`, payload);
  },

  remove(auctionId) {
    return api.delete(`/auctions/${auctionId}`);
  },

  start(auctionId) {
    return api.post(`/auctions/${auctionId}/start`);
  },

  end(auctionId) {
    return api.post(`/auctions/${auctionId}/end`);
  },
};

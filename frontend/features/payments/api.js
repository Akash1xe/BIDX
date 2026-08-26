import { api } from "@/services/api-client";

export const paymentsApi = {
  createOrder(auctionId) {
    return api.post(`/payments/order/${auctionId}`);
  },

  confirm(payload) {
    return api.post("/payments/confirm", payload);
  },

  listMine(params = {}) {
    return api.get("/payments/mine", { params });
  },

  getByAuction(auctionId) {
    return api.get(`/payments/auction/${auctionId}`);
  },
};

import { api } from "@/services/api-client";

export const notificationsApi = {
  listMine(userId, params = {}) {
    return api.get("/notifications/mine", { params: { userId, ...params } });
  },

  listByAuction(auctionId) {
    return api.get(`/notifications/auction/${auctionId}`);
  },
};

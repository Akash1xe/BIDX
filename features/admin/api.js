import { api } from "@/services/api-client";

export const adminApi = {
  stats() {
    return api.get("/admin/stats");
  },

  listUsers(params = {}) {
    return api.get("/admin/users", { params });
  },

  setUserSuspended(userId, payload) {
    return api.patch(`/admin/users/${userId}/suspend`, payload);
  },

  listAuctions(params = {}) {
    return api.get("/admin/auctions", { params });
  },

  listAudit(params = {}) {
    return api.get("/admin/audit", { params });
  },
};

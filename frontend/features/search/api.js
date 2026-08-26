import { api } from "@/services/api-client";

export const searchApi = {
  search(params = {}) {
    return api.get("/search", { params });
  },

  suggest(query) {
    return api.get("/search/suggest", { params: { q: query } });
  },
};


import { api } from "@/services/api-client";

export const productsApi = {
  listMine(params = {}) {
    return api.get("/products/mine", { params });
  },

  create(payload) {
    return api.post("/products", payload);
  },

  getById(productId) {
    return api.get(`/products/${productId}`);
  },

  remove(productId) {
    return api.delete(`/products/${productId}`);
  },
};

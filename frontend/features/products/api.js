import { api } from "@/services/api-client";

export const productsApi = {
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

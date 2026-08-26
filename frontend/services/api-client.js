import apiClient from "@/lib/axios";

function unwrap(response) {
  return response.data?.data ?? null;
}

export const api = {
  async get(url, config) {
    return unwrap(await apiClient.get(url, config));
  },

  async post(url, body, config) {
    return unwrap(await apiClient.post(url, body, config));
  },

  async put(url, body, config) {
    return unwrap(await apiClient.put(url, body, config));
  },

  async patch(url, body, config) {
    return unwrap(await apiClient.patch(url, body, config));
  },

  async delete(url, config) {
    return unwrap(await apiClient.delete(url, config));
  },
};


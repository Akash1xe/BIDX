import axios from "axios";
import { env } from "@/lib/env";
import { authBridge } from "@/services/auth-bridge";
import { normalizeApiError } from "@/utils/api-error";

const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeoutMs,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

apiClient.interceptors.request.use((config) => {
  const accessToken = authBridge.getAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isRefreshRequest = request?.url?.includes("/auth/refresh");

    if (isUnauthorized && request && !request._retry && !isRefreshRequest) {
      request._retry = true;

      try {
        refreshPromise ||= authBridge.refresh().finally(() => {
          refreshPromise = null;
        });

        const accessToken = await refreshPromise;
        request.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(request);
      } catch (refreshError) {
        authBridge.onAuthFailure();
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default apiClient;


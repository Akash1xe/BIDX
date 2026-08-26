import { api } from "@/services/api-client";

export const authApi = {
  sendOtp(email) {
    return api.post("/auth/send-otp", { email });
  },

  verifyOtp(email, otp) {
    return api.post("/auth/verify-otp", { email, otp });
  },

  signup(payload) {
    return api.post("/auth/signup", payload);
  },

  login(payload) {
    return api.post("/auth/login", payload);
  },

  googleLogin(idToken) {
    return api.post("/auth/google", { idToken });
  },

  refresh(refreshToken) {
    return api.post("/auth/refresh", { refreshToken });
  },

  logout(refreshToken) {
    return api.post("/auth/logout", refreshToken ? { refreshToken } : {});
  },
};


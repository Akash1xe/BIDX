/**
 * Connects the HTTP layer to the future AuthProvider without making the
 * Axios client depend on React or browser storage.
 */
let accessTokenResolver = () => null;
let refreshHandler = null;
let authFailureHandler = () => {};

export const authBridge = {
  getAccessToken() {
    return accessTokenResolver();
  },

  refresh() {
    return refreshHandler ? refreshHandler() : Promise.reject(new Error("No refresh handler configured"));
  },

  onAuthFailure() {
    authFailureHandler();
  },

  configure({ getAccessToken, refresh, onAuthFailure } = {}) {
    accessTokenResolver = getAccessToken || (() => null);
    refreshHandler = refresh || null;
    authFailureHandler = onAuthFailure || (() => {});
  },

  reset() {
    accessTokenResolver = () => null;
    refreshHandler = null;
    authFailureHandler = () => {};
  },
};


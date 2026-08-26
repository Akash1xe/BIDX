const SESSION_KEY = "bidx-session";

export function readStoredSession() {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session) {
  if (typeof window === "undefined") return;

  if (session) {
    // Keep the short-lived access token in memory. The current backend still
    // requires a JS-readable refresh token until it can issue an HttpOnly
    // cookie, so persist only the minimum session needed to bootstrap.
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({
      user: session.user,
      tokens: { refreshToken: session.tokens?.refreshToken },
    }));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

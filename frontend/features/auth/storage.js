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
    // Access tokens always stay in memory. A refresh token is retained only
    // when a legacy backend returns one; the production backend uses an
    // HttpOnly cookie, so this field is omitted automatically.
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({
      user: session.user,
      tokens: { refreshToken: session.tokens?.refreshToken },
    }));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

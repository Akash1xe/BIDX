import { readStoredSession, writeStoredSession } from "@/features/auth/storage";

const DEFAULT_API_URL = "http://localhost:4000";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "") ||
  process.env.NEXT_PUBLIC_BIDX_API_URL ||
  DEFAULT_API_URL;

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_BIDX_SOCKET_URL ||
  "http://localhost:4000";

export function readSession() {
  return readStoredSession();
}

export function saveSession(session) {
  writeStoredSession(session);
}

function messageFrom(payload, fallback) {
  return payload?.message || payload?.error?.message || payload?.error || fallback;
}

export async function api(path, options = {}) {
  const session = readSession();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (session?.tokens?.accessToken) {
    headers.set("authorization", `Bearer ${session.tokens.accessToken}`);
  }

  const request = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body:
        options.body && typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    });

  let response = await request();
  if (response.status === 401 && session?.tokens?.refreshToken && path !== "/api/v1/auth/refresh") {
    const refreshResponse = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      const nextSession = {
        user: refreshed.data?.user?.toPublicProfile
          ? refreshed.data.user.toPublicProfile
          : refreshed.data?.user || session.user,
        tokens: refreshed.data?.tokens,
      };
      saveSession(nextSession);
      headers.set("authorization", `Bearer ${nextSession.tokens.accessToken}`);
      response = await request();
    } else {
      saveSession(null);
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status})`));
  }
  return payload.data;
}

export function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `bid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

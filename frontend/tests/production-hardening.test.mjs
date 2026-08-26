import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readStoredSession, writeStoredSession } from "../features/auth/storage.js";
import { normalizeApiError } from "../utils/api-error.js";

test("browser storage never persists the access token", () => {
  const values = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };

  writeStoredSession({
    user: { id: "user-1", role: "USER" },
    tokens: { accessToken: "must-not-persist", refreshToken: "refresh-only" },
  });

  const stored = readStoredSession();
  assert.equal(stored.tokens.accessToken, undefined);
  assert.equal(stored.tokens.refreshToken, "refresh-only");
  delete global.window;
});

test("session bootstrap supports an HttpOnly refresh cookie", async () => {
  const provider = await readFile(new URL("../providers/AuthProvider.js", import.meta.url), "utf8");
  const authApi = await readFile(new URL("../features/auth/api.js", import.meta.url), "utf8");
  assert.match(provider, /if \(!stored\?\.user\)/);
  assert.match(provider, /authApi\.refresh\(stored\.tokens\?\.refreshToken\)/);
  assert.match(authApi, /refreshToken \? \{ refreshToken \} : \{\}/);
});

test("seller activation refreshes the role and inventory uses the owned endpoint", async () => {
  const provider = await readFile(new URL("../providers/AuthProvider.js", import.meta.url), "utf8");
  const authApi = await readFile(new URL("../features/auth/api.js", import.meta.url), "utf8");
  const productsApi = await readFile(new URL("../features/products/api.js", import.meta.url), "utf8");
  assert.match(authApi, /post\("\/users\/me\/seller"/);
  assert.match(provider, /await authApi\.becomeSeller\(\);\s*await refresh\(\)/);
  assert.match(productsApi, /get\("\/products\/mine"/);
  assert.doesNotMatch(productsApi, /sellerId/);
});

test("API errors retain status and gateway request ID", () => {
  const error = normalizeApiError({
    response: { status: 429, data: {}, headers: { "x-request-id": "req-123" } },
  });
  assert.equal(error.status, 429);
  assert.equal(error.requestId, "req-123");
  assert.match(error.message, /Too many requests/);
});

test("production container is non-root and has a health check", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /NEXT_PUBLIC_API_URL/);
});

test("full-stack compose exposes only the gateway to the browser", async () => {
  const compose = await readFile(new URL("../docker-compose.full.yml", import.meta.url), "utf8");
  assert.match(compose, /USER_SERVICE_URL: http:\/\/user-service:4001/);
  assert.match(compose, /NEXT_PUBLIC_API_URL: http:\/\/localhost:4000\/api\/v1/);
  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_URL: http:\/\/(user-service|auction-service|bidding-service)/);
});

test("security headers deny framing and object embedding", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /X-Frame-Options.*DENY/);
  assert.match(worker, /object-src 'none'/);
  assert.match(worker, /Strict-Transport-Security/);
});

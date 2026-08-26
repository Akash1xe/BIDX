const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("notification gateway route requires an access token", async () => {
  const routes = await read("api-gateway/src/config/routes.js");
  assert.match(routes, /prefix: "\/api\/v1\/notifications"[^}]+auth: true/);
});

test("notification mine route trusts only gateway identity", async () => {
  const routes = await read("notification-service/src/routes/index.js");
  assert.match(routes, /listByUser\(req\.user\.id/);
  assert.doesNotMatch(routes, /req\.query\.userId/);
  assert.match(routes, /"\/stats", requireAdmin/);
  assert.match(routes, /"\/auction\/:auctionId", requireAdmin/);
});

test("gateway preserves webhook bytes before JSON parsing", async () => {
  const app = await read("api-gateway/src/app.js");
  const raw = app.indexOf("payments/webhook");
  const json = app.indexOf("express.json");
  assert.ok(raw !== -1 && json !== -1 && raw < json);
  const proxy = await read("api-gateway/src/proxy/proxy.service.js");
  assert.match(proxy, /Buffer\.isBuffer\(req\.body\)/);
  assert.match(proxy, /rawBody \? req\.body/);
});

test("gateway forwards refresh cookies and proxies Socket.IO upgrades", async () => {
  const proxy = await read("api-gateway/src/proxy/proxy.service.js");
  const server = await read("api-gateway/src/server.js");
  assert.match(proxy, /getSetCookie/);
  assert.match(proxy, /headers\["set-cookie"\]/);
  assert.match(server, /server\.on\("upgrade"/);
  assert.match(server, /proxySocketUpgrade/);
});

test("refresh sessions use HttpOnly cookies with origin protection", async () => {
  const controller = await read("user-service/src/controllers/auth.controller.js");
  const csrf = await read("api-gateway/src/middleware/csrf.middleware.js");
  assert.match(controller, /httpOnly: true/);
  assert.match(controller, /res\.cookie\(env\.auth\.refreshCookieName/);
  assert.match(controller, /res\.clearCookie/);
  assert.match(csrf, /Untrusted origin/);
});

test("backend blocks admin self-suspension", async () => {
  const controller = await read("admin-service/src/controllers/admin.controller.js");
  assert.match(controller, /req\.params\.id === req\.user\.id/);
  assert.match(controller, /cannot suspend their own account/);
});

test("all Render web services honor the platform PORT", async () => {
  const configs = [
    "api-gateway/src/config/env.js",
    "user-service/src/config/env.js",
    "auction-service/src/config/env.js",
    "search-service/src/config/env.js",
    "bidding-service/src/config/env.js",
    "payment-service/src/config/env.js",
    "notification-service/src/config/env.js",
    "admin-service/src/config/env.js"
  ];
  for (const file of configs) {
    assert.match(await read(file), /process\.env\.PORT/, `${file} must use Render's PORT`);
  }
});

test("demo mode removes Kafka and Elasticsearch startup dependencies", async () => {
  for (const file of [
    "user-service/src/server.js",
    "auction-service/src/server.js",
    "bidding-service/src/server.js",
    "payment-service/src/server.js",
    "notification-service/src/server.js",
    "search-service/src/server.js"
  ]) {
    assert.match(await read(file), /env\.demoMode/, `${file} must gate optional infrastructure`);
  }

  const search = await read("search-service/src/services/search.service.js");
  assert.match(search, /fetchDemoAuctions/);
  assert.match(search, /AUCTION_SERVICE_URL|auctionServiceUrl/);
  assert.match(search, /mode: "demo"/);
});

test("gateway returns empty demo history when optional services are unavailable", async () => {
  const env = await read("api-gateway/src/config/env.js");
  const proxy = await read("api-gateway/src/middleware/proxy.middleware.js");
  assert.match(env, /demoMode:/);
  assert.match(proxy, /pathname === "\/api\/v1\/payments\/mine"/);
  assert.match(proxy, /pathname === "\/api\/v1\/notifications\/mine"/);
  assert.match(proxy, /X-BidX-Demo-Fallback/);
  assert.match(proxy, /result\.status >= 500/);
});

test("demo payments resolve winners from the Auction Service and require no browser-forged signature", async () => {
  const payment = await read("payment-service/src/services/payment.service.js");
  const frontend = await read("frontend/components/payment/PaymentCheckout.jsx");
  assert.match(payment, /fetchDemoWinner/);
  assert.match(payment, /env\.auctionServiceUrl/);
  assert.match(payment, /demoConfirmation/);
  assert.match(payment, /source: demoConfirmation \? "demo-checkout"/);
  assert.match(frontend, /confirmPayment\.mutateAsync\(\{ orderId: order\.orderId \}\)/);
  assert.doesNotMatch(frontend, /does not expose a signed mock-confirmation endpoint/);
});

test("payment startup logs never include MongoDB credentials", async () => {
  const db = await read("payment-service/src/config/db.js");
  assert.match(db, /new URL\(uri\)\.host/);
  assert.doesNotMatch(db, /uri\.split\("\/\/"\)\[1\]/);
});

test("frontend tolerates Render free-tier cold starts", async () => {
  const env = await read("frontend/lib/env.js");
  const client = await read("frontend/lib/axios.js");
  assert.match(env, /NEXT_PUBLIC_API_TIMEOUT_MS \|\| 90_000/);
  assert.match(client, /timeout: env\.apiTimeoutMs/);
});

test("gateway tolerates Render free-tier upstream cold starts", async () => {
  const env = await read("api-gateway/src/config/env.js");
  assert.match(env, /UPSTREAM_TIMEOUT_MS \|\| "60000"/);
});

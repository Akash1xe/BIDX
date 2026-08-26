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

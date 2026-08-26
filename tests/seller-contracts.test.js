const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFile(path.join(root, file), "utf8");

test("seller onboarding is authenticated, idempotent, and rotates into a public session", async () => {
  const routes = await read("user-service/src/routes/user.routes.js");
  const service = await read("user-service/src/services/user.service.js");
  const tokens = await read("user-service/src/services/token.service.js");
  assert.match(routes, /router\.use\("\/me", requireAuth\)/);
  assert.match(routes, /post\("\/me\/seller"/);
  assert.match(service, /current\.role === ROLES\.SELLER \|\| current\.role === ROLES\.ADMIN/);
  assert.match(service, /role: ROLES\.SELLER/);
  assert.match(tokens, /user: user\.toPublicProfile\(\), tokens/);
});

test("seller inventory uses gateway identity and never accepts a caller seller id", async () => {
  const gateway = await read("api-gateway/src/config/routes.js");
  const routes = await read("auction-service/src/routes/index.js");
  const controller = await read("auction-service/src/controllers/product.controller.js");
  const repository = await read("auction-service/src/repositories/product.repository.js");
  assert.match(gateway, /prefix: "\/api\/v1\/products\/mine".*auth: true/);
  assert.match(routes, /get\("\/products\/mine", requireIdentity/);
  assert.match(controller, /sellerId: req\.user\.id/);
  assert.doesNotMatch(controller, /req\.query\.sellerId/);
  assert.match(repository, /filter = \{ sellerId, isRemoved: false \}/);
});

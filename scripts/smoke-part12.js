const { execSync } = require("child_process");

const GATEWAY = "http://localhost:4000";
let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.log(`FAIL ${label}${detail ? " " + JSON.stringify(detail).slice(0, 300) : ""}`); }
}

async function rawFetch(method, url, h, body) {
  return fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
}

async function call(method, path, { body, token } = {}) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  const url = path.startsWith("http") ? path : GATEWAY + path;
  let res;
  try {
    res = await rawFetch(method, url, h, body);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      res = await rawFetch(method, url, h, body);
    } catch (e2) {
      throw new Error(`FETCH ${method} ${url} failed: ${e2.message}`);
    }
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function uid(t) {
  if (!t) return null;
  try { return JSON.parse(Buffer.from(t.split(".")[1], "base64").toString()).sub; }
  catch { return null; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function registerUser(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}.${Math.floor(Math.random() * 9999)}@bidx.dev`;
  const otpRes = await call("POST", "/api/v1/auth/send-otp", { body: { email } });
  const otp = otpRes.json?.data?.devOtp;
  await call("POST", "/api/v1/auth/verify-otp", { body: { email, otp } });
  const signup = await call("POST", "/api/v1/auth/signup", {
    body: { name, email, password: "Passw0rd!23" }
  });
  const token = signup.json?.data?.tokens?.accessToken;
  return { email, token, userId: uid(token) };
}

function promote(email, role) {
  execSync(`node scripts/promote-${role}.js ${email}`, { encoding: "utf8", cwd: "C:\\bidx" });
}

async function login(email, password) {
  const r = await call("POST", "/api/v1/auth/login", { body: { email, password } });
  return { token: r.json?.data?.tokens?.accessToken, status: r.status };
}

async function main() {
  // admin setup
  const admin = await registerUser("Admin Boss");
  promote(admin.email, "admin");
  const adminLogin = await login(admin.email, "Passw0rd!23");
  check("admin promoted and can login", Boolean(adminLogin.token));

  const seller = await registerUser("Admin Test Seller");
  promote(seller.email, "seller");
  const sellerLogin = await login(seller.email, "Passw0rd!23");
  const buyer = await registerUser("Admin Test Buyer");
  const buyer2 = await registerUser("Admin Second Buyer");

  // non-admin blocked
  const forbidden = await call("GET", "/api/v1/admin/stats", { token: buyer.token });
  check("non-admin gets 403 on admin API", forbidden.status === 403);

  const anon = await call("GET", "/api/v1/admin/stats");
  check("anonymous gets 401 on admin API", anon.status === 401 || anon.status === 403);

  // users listing
  const usersRes = await call("GET", "/api/v1/admin/users?limit=50", { token: adminLogin.token });
  check("admin lists users", usersRes.status === 200 && Array.isArray(usersRes.json?.data?.items) && usersRes.json.data.total >= 4);
  const foundSeller = (usersRes.json?.data?.items || []).find((u) => u.email === seller.email);
  check("user list includes seller role without password leak", Boolean(foundSeller && foundSeller.role === "SELLER" && !foundSeller.password));

  const searchRes = await call("GET", `/api/v1/admin/users?q=${encodeURIComponent(seller.email)}`, { token: adminLogin.token });
  check("user search by email works", searchRes.status === 200 && searchRes.json?.data?.total === 1);

  // suspend buyer -> login rejected
  const susp = await call("PATCH", `/api/v1/admin/users/${buyer.userId}/suspend`, {
    token: adminLogin.token,
    body: { isSuspended: true, reason: "smoke test suspension" }
  });
  check("admin suspends buyer", susp.status === 200 && susp.json?.data?.modified === 1);

  const blockedLogin = await login(buyer.email, "Passw0rd!23");
  check("suspended user cannot login", blockedLogin.status === 403);

  // unsuspend -> login works again
  const unsusp = await call("PATCH", `/api/v1/admin/users/${buyer.userId}/suspend`, {
    token: adminLogin.token,
    body: { isSuspended: false }
  });
  check("admin unsuspends buyer", unsusp.status === 200);
  const reLogin = await login(buyer.email, "Passw0rd!23");
  check("unsuspended user can login again", Boolean(reLogin.token));

  // auctions listing
  const prod = await call("POST", "/api/v1/products", {
    token: sellerLogin.token,
    body: { name: "Admin Item", description: "x", category: "Misc", condition: "NEW", images: [] }
  });
  const productId = prod.json?.data?.id;
  const now = Date.now();
  const auc = await call("POST", "/api/v1/auctions", {
    token: sellerLogin.token,
    body: { productId, startingPrice: 500, minimumIncrement: 50, startTime: new Date(now + 400).toISOString(), endTime: new Date(now + 60000).toISOString() }
  });
  const auctionId = auc.json?.data?.id;

  const auctionsRes = await call("GET", "/api/v1/admin/auctions?limit=50", { token: adminLogin.token });
  check("admin lists auctions incl new one", auctionsRes.status === 200 && (auctionsRes.json?.data?.items || []).some((a) => a._id === auctionId));

  const byStatus = await call("GET", "/api/v1/admin/auctions?status=DRAFT&limit=50", { token: adminLogin.token });
  check("auction filter by status works", byStatus.status === 200 && (byStatus.json?.data?.items || []).every((a) => a.status === "DRAFT"));

  // stats
  const stats = await call("GET", "/api/v1/admin/stats", { token: adminLogin.token });
  const d = stats.json?.data || {};
  check(
    "platform stats shape correct",
    stats.status === 200 &&
      typeof d.users === "number" && d.users >= 5 &&
      typeof d.auctions === "number" && typeof d.bids === "number" &&
      typeof d.gmvMinor === "number",
    d
  );

  // audit trail
  const audit = await call("GET", "/api/v1/admin/audit?limit=10", { token: adminLogin.token });
  const entries = audit.json?.data?.items || [];
  check(
    "audit log records suspend/unsuspend actions",
    audit.status === 200 &&
      entries.some((e) => e.action === "USER_SUSPENDED" && e.targetId === buyer.userId) &&
      entries.some((e) => e.action === "USER_UNSUSPENDED"),
    entries.map((e) => e.action)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASH:", e.message); process.exit(1); });

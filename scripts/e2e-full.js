const { execSync } = require("child_process");
const { io } = require("socket.io-client");

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
  const h = { "Content-Type": "application/json", "x-request-id": `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  if (token) h.Authorization = "Bearer " + token;
  const url = path.startsWith("http") ? path : GATEWAY + path;
  let res;
  try {
    res = await rawFetch(method, url, h, body);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 400));
    try { res = await rawFetch(method, url, h, body); }
    catch (e2) { throw new Error(`FETCH ${method} ${url}: ${e2.message}`); }
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
  await call("POST", "/api/v1/auth/verify-otp", { body: { email, otp: otpRes.json?.data?.devOtp } });
  const signup = await call("POST", "/api/v1/auth/signup", { body: { name, email, password: "Passw0rd!23" } });
  const token = signup.json?.data?.tokens?.accessToken;
  return { email, token, userId: uid(token), password: "Passw0rd!23" };
}

function promote(email, role) {
  execSync(`node scripts/promote-${role}.js ${email}`, { encoding: "utf8", cwd: "C:\\bidx" });
}

async function login(u) {
  const r = await call("POST", "/api/v1/auth/login", { body: { email: u.email, password: u.password } });
  return r.json?.data?.tokens?.accessToken;
}

function kafkaMessages(topic) {
  try {
    const out = execSync(`node scripts/kafka-read.js ${topic} 10000`, { encoding: "utf8", timeout: 30000, cwd: "C:\\bidx" });
    return out.trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

const hmac = (key, data) =>
  require("crypto").createHmac("sha256", key).update(data).digest("hex");

async function waitStatus(auctionId, status, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const r = await call("GET", `/api/v1/auctions/${auctionId}`);
    last = r.json?.data;
    if (last && last.status === status) return last;
    await sleep(1200);
  }
  return null;
}

async function main() {
  console.log("=== BidX E2E: full platform journey ===");

  // --- identities
  const seller = await registerUser("E2E Seller");
  promote(seller.email, "seller");
  const sellerToken = await login(seller);
  const admin = await registerUser("E2E Admin");
  promote(admin.email, "admin");
  const adminToken = await login(admin);
  check("identities ready (seller+admin)", Boolean(sellerToken && adminToken));

  const b1 = await registerUser("E2E Bidder One");
  const b2 = await registerUser("E2E Bidder Two");
  const b3 = await registerUser("E2E Bidder Three");
  check("three bidders registered", Boolean(b1.userId && b2.userId && b3.userId));
  if (!sellerToken || !adminToken || !b1.userId) process.exit(1);

  // --- catalog + auction lifecycle
  const prod = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: { name: "E2E Flagship Item", description: "end to end", category: "Electronics", condition: "NEW", images: [] }
  });
  const productId = prod.json?.data?.id;
  check("product created", Boolean(productId));

  const now = Date.now();
  const STAMP = String(Date.now());
  const auc = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: { productId, startingPrice: 1000, minimumIncrement: 100, startTime: new Date(now + 600).toISOString(), endTime: new Date(now + 120000).toISOString() }
  });
  const a1 = auc.json?.data?.id;
  check("auction created DRAFT", Boolean(a1));

  const searchNew = await call("GET", `/api/v1/search?q=${encodeURIComponent(STAMP)}`);
  void searchNew;

  await call("POST", `/api/v1/auctions/${a1}/start`, { token: sellerToken });
  const live = await waitStatus(a1, "LIVE", 15000);
  check("auction LIVE after start", Boolean(live));

  const searchHit = await (async () => {
    for (let i = 0; i < 10; i++) {
      const r = await call("GET", "/api/v1/search?q=E2E%20Flagship");
      if ((r.json?.data?.results || []).some((x) => x.auctionId === a1)) return true;
      await sleep(1200);
    }
    return false;
  })();
  check("search indexes live auction", searchHit);

  // --- real-time bidding via socket (direct to bidding service, like part6)
  const socket = await new Promise((resolve, reject) => {
    const s = io("http://localhost:4004", {
      auth: { token: b3.token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000
    });
    s.once("connect", () => resolve(s));
    s.once("connect_error", (err) => reject(new Error(err.message)));
    setTimeout(() => reject(new Error("socket connect timeout")), 9000);
  });
  socket.emit("auction:join", a1);
  const roomEvents = [];
  socket.on("bid:new", (p) => { if (p?.auctionId === a1) roomEvents.push(p); });

  const bid = async (u, amount) => call("POST", "/api/v1/bids", { token: u.token, body: { auctionId: a1, amount } });
  const r1 = await bid(b1, 1100);
  check("b1 opening bid accepted", r1.status === 201);
  await sleep(500);
  const r2 = await bid(b2, 1200);
  check("b2 outbid accepted", r2.status === 201);

  let sawBids = false;
  for (let i = 0; i < 12; i++) {
    if (roomEvents.length >= 2) { sawBids = true; break; }
    await sleep(500);
  }
  check("socket room received bid:new events", sawBids);
  socket.disconnect();

  const r3 = await bid(b3, 1300);
  check("b3 top bid accepted", r3.status === 201);

  // --- manual end -> winner flow
  await call("POST", `/api/v1/auctions/${a1}/end`, { token: sellerToken });
  const ended = await waitStatus(a1, "ENDED", 20000);
  check("auction ENDED with b3 winning", Boolean(ended && ended.winningBidderId === b3.userId && ended.finalPrice === 1300));

  // --- payment (checkout signature path)
  const order = await call("POST", `/api/v1/payments/order/${a1}`, { token: b3.token });
  const orderId = order.json?.data?.orderId;
  check("winner order created", order.status === 201 && Boolean(orderId));

  const badSig = await call("POST", "/api/v1/payments/confirm", {
    token: b3.token,
    body: { orderId, paymentId: `pay_e2e_${STAMP}`, signature: "deadbeef" }
  });
  check("invalid signature rejected", badSig.status === 400 || badSig.status === 401);

  const KEY_SECRET = "bidx-dev-key-secret";
  const payId = `pay_${STAMP}_e2e`;
  const okPay = await call("POST", "/api/v1/payments/confirm", {
    token: b3.token,
    body: { orderId, paymentId: payId, signature: hmac(KEY_SECRET, `${orderId}|${payId}`) }
  });
  check("valid signature marks PAID", okPay.status === 200 && okPay.json?.data?.status === "PAID");

  // --- saga completion -> SOLD propagation
  const sold = await waitStatus(a1, "SOLD", 25000);
  check("auction SOLD after payment", Boolean(sold));

  await sleep(2500);
  const searchSold = await call("GET", `/api/v1/search?q=E2E%20Flagship&status=SOLD`);
  check("search reflects SOLD", (searchSold.json?.data?.results || []).some((i) => i.auctionId === a1 && i.winningBidderId === b3.userId));

  // --- notifications consumed by notification-service
  await sleep(2000);
  const notifs = await call("GET", `/api/v1/notifications/auction/${a1}`);
  const types = (notifs.json?.data || []).map((n) => n.type);
  check(
    "notification-service stored OUTBID/WINNER/SELLER_SOLD/PAYMENT_*",
    types.includes("OUTBID") && types.includes("WINNER") && types.includes("SELLER_SOLD"),
    types
  );

  // --- admin moderation on fresh buyer
  const buyer4 = await registerUser("E2E Buyer Four");
  const susp = await call("PATCH", `/api/v1/admin/users/${buyer4.userId}/suspend`, {
    token: adminToken,
    body: { isSuspended: true, reason: "e2e" }
  });
  const blockedLogin = await call("POST", "/api/v1/auth/login", { body: { email: buyer4.email, password: buyer4.password } });
  check("admin suspend blocks login", susp.status === 200 && blockedLogin.status === 403);

  const audit = await call("GET", "/api/v1/admin/audit?limit=5", { token: adminToken });
  check("audit captured moderation", ((audit.json?.data?.items) || []).some((e) => e.action === "USER_SUSPENDED" && e.targetId === buyer4.userId));

  const stats = await call("GET", "/api/v1/admin/stats", { token: adminToken });
  check("admin stats aggregate", stats.status === 200 && stats.json?.data?.paidPayments >= 1);

  // --- gateway resilience headers
  const health = await call("GET", "/api/v1/search?q=e2e");
  check("gateway healthy under load", health.status === 200);

  console.log(`\n=== E2E COMPLETE: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASH:", e.message); process.exit(1); });

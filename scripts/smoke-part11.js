const { execSync } = require("child_process");

const GATEWAY = "http://localhost:4000";
const NOTIF = "http://localhost:4006";
let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.log(`FAIL ${label}${detail ? " " + JSON.stringify(detail) : ""}`); }
}

async function rawFetch(method, url, h, body) {
  return fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
}

async function call(method, url, { body, token, headers: extra } = {}) {
  const h = { "Content-Type": "application/json", ...extra };
  if (token) h.Authorization = "Bearer " + token;
  let res;
  try {
    res = await rawFetch(method, url, h, body);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      res = await rawFetch(method, url, h, body);
    } catch (e2) {
      throw new Error(`FETCH ${method} ${url} failed: ${e2.message}${e2.cause ? " | cause: " + (e2.cause.message || e2.cause.code || e2.cause) : ""}`);
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
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@bidx.dev`;
  const otpRes = await call("POST", `${GATEWAY}/api/v1/auth/send-otp`, { body: { email } });
  const otp = otpRes.json?.data?.devOtp;
  await call("POST", `${GATEWAY}/api/v1/auth/verify-otp`, { body: { email, otp } });
  const signup = await call("POST", `${GATEWAY}/api/v1/auth/signup`, {
    body: { name, email, password: "Passw0rd!23" }
  });
  const token = signup.json?.data?.tokens?.accessToken;
  const userId = uid(token);
  return { email, token, userId };
}

function promoteToSeller(email) {
  execSync(`node scripts/promote-seller.js ${email}`, { encoding: "utf8", cwd: "C:\\bidx" });
}

async function login(email, password) {
  const res = await call("POST", `${GATEWAY}/api/v1/auth/login`, { body: { email, password } });
  return res.json?.data?.tokens?.accessToken;
}

function kafkaMessages(topic) {
  try {
    const out = execSync(
      `node scripts/kafka-read.js ${topic} 12000`,
      { encoding: "utf8", timeout: 30000, cwd: "C:\\bidx" }
    );
    return out.trim().split("\n").filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

async function main() {
  const seller = await registerUser("Notif Seller");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, "Passw0rd!23");
  const buyer1 = await registerUser("Notif Buyer One");
  const buyer2 = await registerUser("Notif Buyer Two");

  const prod = await call("POST", `${GATEWAY}/api/v1/products`, {
    token: sellerToken,
    body: { name: "Notif Test Item", description: "test", category: "Electronics", condition: "NEW", images: [] }
  });
  const productId = prod.json?.data?.id;

  const now = Date.now();
  const auc = await call("POST", `${GATEWAY}/api/v1/auctions`, {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 1000,
      minimumIncrement: 100,
      startTime: new Date(now + 500).toISOString(),
      endTime: new Date(now + 60000).toISOString()
    }
  });
  const auctionId = auc.json?.data?.id;
  await call("POST", `${GATEWAY}/api/v1/auctions/${auctionId}/start`, { token: sellerToken });

  await call("POST", `${GATEWAY}/api/v1/bids`, { token: buyer1.token, body: { auctionId, amount: 1100 } });
  await call("POST", `${GATEWAY}/api/v1/bids`, { token: buyer2.token, body: { auctionId, amount: 1200 } });

  const notifsBefore = kafkaMessages("notification.email").filter((m) => m?.data?.auctionId === auctionId);

  await call("POST", `${GATEWAY}/api/v1/auctions/${auctionId}/end`, { token: sellerToken });
  await sleep(3000);

  const notifsAfter = kafkaMessages("notification.email").filter((m) => m?.data?.auctionId === auctionId);

  const outbidEvent = notifsAfter.find((n) => n.data.type === "OUTBID" && n.data.userId === buyer1.userId);
  const winnerEvent = notifsAfter.find((n) => n.data.type === "WINNER" && n.data.userId === buyer2.userId);
  const sellerEvent = notifsAfter.find((n) => n.data.type === "SELLER_SOLD" && n.data.userId === seller.userId);

  check("OUTBID notification emitted for displaced bidder", Boolean(outbidEvent));
  check("WINNER notification emitted for winning bidder", Boolean(winnerEvent));
  check("SELLER_SOLD notification emitted for seller", Boolean(sellerEvent));
  check("notifications have auctionId", notifsAfter.every((n) => n.data.auctionId === auctionId));

  const healthRes = await call("GET", `${NOTIF}/api/v1/health`);
  check("notification-service healthy", healthRes.status === 200 && healthRes.json?.data?.status === "healthy");
  check("health shows mode=dev", healthRes.json?.data?.mode === "dev");

  const statsRes = await call("GET", `${NOTIF}/api/v1/notifications/stats`);
  check("stats endpoint returns counts", statsRes.status === 200 && typeof statsRes.json?.data?.total === "number");

  const mineRes = await call("GET", `${NOTIF}/api/v1/notifications/mine?userId=${buyer2.userId}`);
  check("mine endpoint returns buyer2 notifications", mineRes.status === 200 && Array.isArray(mineRes.json?.data));

  const auctionNotifs = await call("GET", `${NOTIF}/api/v1/notifications/auction/${auctionId}`);
  check("auction notifications endpoint works", auctionNotifs.status === 200 && Array.isArray(auctionNotifs.json?.data));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASH:", e.message); if (e.stack) console.error(e.stack.split("\n").slice(0, 4).join("\n")); process.exit(1); });

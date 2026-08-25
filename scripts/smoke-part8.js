const { execSync } = require("child_process");
const GATEWAY = process.env.SMOKE_GATEWAY_URL || "http://localhost:4000";

let passed = 0;
let failed = 0;
const STAMP = `p8-${Date.now()}`;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 30000, intervalMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

async function call(method, path, { body, token, headers } = {}, attempt = 0) {
  const h = { "Content-Type": "application/json", ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(500);
      return call(method, path, { body, token, headers }, attempt + 1);
    }
    throw err;
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function kafkaMessages(topic) {
  try {
    const out = execSync(
      `node scripts/kafka-read.js ${topic} 12000`,
      { encoding: "utf8", timeout: 30000, cwd: "C:\\bidx" }
    );
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function decodeUserId(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    return payload.sub || payload.id || null;
  } catch {
    return null;
  }
}

async function registerUser(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}-${Date.now()}-${Math.floor(Math.random() * 1000)}@bidx.dev`;
  const password = "Passw0rd!23";
  const sent = await call("POST", "/api/v1/auth/send-otp", { body: { email } });
  await call("POST", "/api/v1/auth/verify-otp", {
    body: { email, otp: sent.json?.data?.devOtp }
  });
  const signup = await call("POST", "/api/v1/auth/signup", {
    body: { name, email, password }
  });
  const token = signup.json?.data?.tokens?.accessToken;
  return { email, password, token, userId: token ? decodeUserId(token) : null };
}

function promoteToSeller(email) {
  const out = execSync(`node scripts/promote-seller.js ${email}`, {
    encoding: "utf8",
    timeout: 30000
  });
  if (!out.includes("modified=1")) throw new Error(`promotion failed: ${out.trim()}`);
}

async function login(email, password) {
  const r = await call("POST", "/api/v1/auth/login", { body: { email, password } });
  return r.json?.data?.tokens?.accessToken;
}

async function createAuction(sellerToken, productId, endInMs) {
  const now = Date.now();
  const res = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 1000,
      minimumIncrement: 100,
      startTime: new Date(now + 500).toISOString(),
      endTime: new Date(now + endInMs).toISOString()
    }
  });
  const auctionId = res.json?.data?.id;
  await call("POST", `/api/v1/auctions/${auctionId}/start`, { token: sellerToken });
  return auctionId;
}

async function main() {
  const seller = await registerUser("Sonia Completion Seller");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  const bidderA = await registerUser("Alice First Bidder");
  const bidderB = await registerUser("Bob Second Bidder");
  check(
    "users registered with decodable ids",
    Boolean(sellerToken && bidderA.token && bidderB.token && bidderA.userId && bidderB.userId),
    JSON.stringify({ a: Boolean(bidderA.userId), b: Boolean(bidderB.userId) })
  );

  const productRes = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: {
      name: `${STAMP} Rolex Submariner`,
      description: "Completion flow test item",
      category: "Watches",
      condition: "USED",
      images: []
    }
  });
  const productId = productRes.json?.data?.id;

  const auctionSold = await createAuction(sellerToken, productId, 9000);
  check("sold-path auction LIVE", Boolean(auctionSold), JSON.stringify(productRes.json));

  const bid1 = await call("POST", "/api/v1/bids", {
    token: bidderA.token,
    body: { auctionId: auctionSold, amount: 1100 }
  });
  check("first bid accepted", bid1.status === 201, JSON.stringify(bid1.json));

  const bid2 = await call("POST", "/api/v1/bids", {
    token: bidderB.token,
    body: { auctionId: auctionSold, amount: 1200 }
  });
  check("outbidding bid accepted", bid2.status === 201, JSON.stringify(bid2.json));

  await sleep(2500);
  const notifs = kafkaMessages("notification.email").filter(
    (m) => m.data && m.data.auctionId === auctionSold
  );
  const outbidNotif = notifs.find(
    (m) => m.data.type === "OUTBID" && m.data.userId === bidderA.userId
  );
  check(
    "outbid notification emitted for displaced bidder",
    Boolean(outbidNotif),
    JSON.stringify(notifs.map((n) => n.data))
  );

  const endedDoc = await waitFor(async () => {
    const r = await call("GET", `/api/v1/auctions/${auctionSold}`);
    if (r.json?.data?.status === "ENDED") return r.json.data;
    return null;
  });
  check(
    "scheduler auto-ended auction with winner",
    Boolean(endedDoc),
    JSON.stringify(endedDoc || "timeout")
  );
  check(
    "winner and finalPrice persisted",
    endedDoc &&
      endedDoc.winningBidderId === bidderB.userId &&
      endedDoc.finalPrice === 1200 &&
      endedDoc.currentBid === 1200,
    JSON.stringify(endedDoc)
  );

  const winnerEvents = kafkaMessages("winner.selected").filter(
    (m) => m.data && m.data.auctionId === auctionSold
  );
  check(
    "winner.selected event published",
    winnerEvents.length >= 1 &&
      winnerEvents[0].data.winningBidderId === bidderB.userId &&
      winnerEvents[0].data.finalPrice === 1200 &&
      winnerEvents[0].data.sellerId === seller.userId,
    JSON.stringify(winnerEvents.map((w) => w.data))
  );
  check(
    "winner.selected emitted exactly once (idempotent finalize)",
    winnerEvents.length === 1,
    `count=${winnerEvents.length}`
  );

  const endedEvents = kafkaMessages("auction.ended").filter(
    (m) => m.data && m.data.auctionId === auctionSold
  );
  check(
    "auction.ended outcome WINNER_PENDING_PAYMENT",
    endedEvents.length >= 1 && endedEvents[0].data.outcome === "WINNER_PENDING_PAYMENT",
    JSON.stringify(endedEvents.map((e) => e.data))
  );

  const winnerNotif = notifs.find(
    (m) => m.data.type === "WINNER" && m.data.userId === bidderB.userId
  );
  const sellerNotif = notifs.find(
    (m) => m.data.type === "SELLER_SOLD" && m.data.userId === seller.userId
  );
  check(
    "winner + seller notification events emitted",
    Boolean(winnerNotif && sellerNotif),
    JSON.stringify(notifs.map((n) => `${n.data.type}:${n.data.userId}`))
  );

  await sleep(2000);
  const searchEnded = await call(
    "GET",
    `/api/v1/search?q=${encodeURIComponent(STAMP)}&status=ENDED`
  );
  const soldHit = (searchEnded.json?.data?.results || []).find(
    (item) => item.auctionId === auctionSold
  );
  check(
    "search reflects ENDED with winningBidderId",
    Boolean(soldHit && soldHit.winningBidderId === bidderB.userId),
    JSON.stringify(searchEnded.json?.data?.results || [])
  );

  const auctionUnsold = await createAuction(sellerToken, productId, 9000);
  const unsoldDoc = await waitFor(async () => {
    const r = await call("GET", `/api/v1/auctions/${auctionUnsold}`);
    if (r.json?.data?.status === "UNSOLD") return r.json.data;
    return null;
  });
  check(
    "no-bid auction auto-transitions to UNSOLD",
    Boolean(unsoldDoc),
    JSON.stringify(unsoldDoc || "timeout")
  );

  const unsoldEvents = kafkaMessages("auction.ended").filter(
    (m) => m.data && m.data.auctionId === auctionUnsold
  );
  check(
    "unsold auction.ended outcome NO_VALID_BID",
    unsoldEvents.length >= 1 && unsoldEvents[0].data.outcome === "NO_VALID_BID",
    JSON.stringify(unsoldEvents.map((e) => e.data))
  );

  await sleep(1500);
  const searchUnsold = await call(
    "GET",
    `/api/v1/search?q=${encodeURIComponent(STAMP)}&status=UNSOLD`
  );
  const unsoldHit = (searchUnsold.json?.data?.results || []).find(
    (item) => item.auctionId === auctionUnsold
  );
  check("search reflects UNSOLD status", Boolean(unsoldHit), JSON.stringify(searchUnsold.json?.data?.results || []));

  const auctionManual = await createAuction(sellerToken, productId, 60000);
  const manualBid = await call("POST", "/api/v1/bids", {
    token: bidderA.token,
    body: { auctionId: auctionManual, amount: 1100 }
  });
  check("manual-end auction accepted bid", manualBid.status === 201, JSON.stringify(manualBid.json));

  const manualEnd = await call("POST", `/api/v1/auctions/${auctionManual}/end`, {
    token: sellerToken
  });
  check(
    "manual seller end still works",
    manualEnd.status === 200 && manualEnd.json?.data?.status === "ENDED",
    JSON.stringify(manualEnd.json)
  );

  const manualWinnerEvents = kafkaMessages("winner.selected").filter(
    (m) => m.data && m.data.auctionId === auctionManual
  );
  check(
    "manual end emits winner.selected through shared completion logic",
    manualWinnerEvents.length === 1 &&
      manualWinnerEvents[0].data.winningBidderId === bidderA.userId,
    JSON.stringify(manualWinnerEvents.map((w) => w.data))
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SMOKE CRASH:", err.message);
  process.exit(1);
});

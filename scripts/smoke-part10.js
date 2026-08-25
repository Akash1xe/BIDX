const crypto = require("crypto");
const { execSync } = require("child_process");
const GATEWAY = process.env.SMOKE_GATEWAY_URL || "http://localhost:4000";

const WEBHOOK_SECRET = process.env.SMOKE_WEBHOOK_SECRET || "bidx-dev-webhook-secret";
const KEY_SECRET = process.env.SMOKE_KEY_SECRET || "bidx-dev-key-secret";
const STAMP = `p10-${Date.now()}`;

let passed = 0;
let failed = 0;

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

async function call(method, path, { body, token, headers, raw } = {}, attempt = 0) {
  const h = { ...(headers || {}) };
  if (!raw && body !== undefined) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method,
      headers: h,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(500);
      return call(method, path, { body, token, headers, raw }, attempt + 1);
    }
    throw err;
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function kafkaMessages(topic) {
  try {
    const out = execSync(
      `docker exec bidx-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic ${topic} --from-beginning --timeout-ms 5000 2>nul`,
      { encoding: "utf8", timeout: 20000 }
    );
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function decodeUserId(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")).sub || null;
  } catch {
    return null;
  }
}

function hmac(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
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

async function bid(token, auctionId, amount) {
  return call("POST", "/api/v1/bids", { token, body: { auctionId, amount } });
}

async function createOrderFor(auctionId, token) {
  return waitFor(async () => {
    const r = await call("POST", `/api/v1/payments/order/${auctionId}`, { token });
    if (r.status === 201) return r;
    return null;
  }, 30000);
}

function confirmBody(order, paymentId) {
  return {
    orderId: order.orderId,
    paymentId,
    signature: hmac(KEY_SECRET, `${order.orderId}|${paymentId}`)
  };
}

async function main() {
  const seller = await registerUser("Saga Seller Prime");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  const b1 = await registerUser("Saga Bidder One");
  const b2 = await registerUser("Saga Bidder Two");
  const b3 = await registerUser("Saga Bidder Three");
  check(
    "all four users registered with ids",
    Boolean(
      sellerToken &&
        b1.token &&
        b2.token &&
        b3.token &&
        b1.userId &&
        b2.userId &&
        b3.userId
    ),
    JSON.stringify({
      s: Boolean(sellerToken),
      b1: b1.userId,
      b2: b2.userId,
      b3: b3.userId
    })
  );
  if (failed > 0) {
    console.log(`\n${passed} passed, ${failed} failed - aborting, setup incomplete`);
    process.exit(1);
  }

  async function setupAuction(endInMs, bids) {
    const productRes = await call("POST", "/api/v1/products", {
      token: sellerToken,
      body: {
        name: `${STAMP} Saga Item`,
        description: "saga flow item",
        category: "Collectibles",
        condition: "NEW",
        images: []
      }
    });
    const productId = productRes.json?.data?.id;
    const now = Date.now();
    const auctionRes = await call("POST", "/api/v1/auctions", {
      token: sellerToken,
      body: {
        productId,
        startingPrice: 1000,
        minimumIncrement: 100,
        startTime: new Date(now + 500).toISOString(),
        endTime: new Date(now + endInMs).toISOString()
      }
    });
    const auctionId = auctionRes.json?.data?.id;
    await call("POST", `/api/v1/auctions/${auctionId}/start`, { token: sellerToken });
    for (const [token, amount] of bids) {
      const r = await bid(token, auctionId, amount);
      if (r.status !== 201) {
        throw new Error(`scenario bid ${amount} rejected: ${r.status} ${JSON.stringify(r.json)}`);
      }
    }
    return auctionId;
  }

  async function waitStatus(auctionId, status, timeoutMs = 35000) {
    return waitFor(async () => {
      const r = await call("GET", `/api/v1/auctions/${auctionId}`);
      if (r.json?.data?.status === status) return r.json.data;
      return null;
    }, timeoutMs);
  }

  const winnerEventsFor = (auctionId) =>
    kafkaMessages("winner.selected").filter(
      (m) => m.data && m.data.auctionId === auctionId
    );

  // ---- Scenario 1: deadline expiry -> fallback B3 -> B2 -> pays -> SOLD
  const a1 = await setupAuction(9000, [
    [b1.token, 1100],
    [b2.token, 1200],
    [b3.token, 1300]
  ]);
  const ended1 = await waitStatus(a1, "ENDED");
  check("auction1 auto-ended with top bidder B3", Boolean(ended1), `id=${a1}`);

  const orderB3 = await createOrderFor(a1, b3.token);
  check(
    "B3 order created but left unpaid",
    Boolean(orderB3 && orderB3.json?.data?.orderId),
    JSON.stringify(orderB3?.json)
  );

  const fallbackEvent = await waitFor(() => {
    const events = winnerEventsFor(a1);
    const fb = events.find((e) => e.data.winningBidderId === b2.userId);
    return fb || null;
  }, 65000);
  check(
    "deadline expiry falls back to next bidder B2 at their max bid",
    Boolean(fallbackEvent && fallbackEvent.data.finalPrice === 1200),
    JSON.stringify(fallbackEvent?.data)
  );

  // pay IMMEDIATELY - deadline is ticking toward the next expiry
  const orderB2 = await createOrderFor(a1, b2.token);
  check(
    "B2 order created after fallback",
    Boolean(orderB2 && orderB2.json?.data?.orderId),
    JSON.stringify(orderB2?.json)
  );
  if (!orderB2) {
    console.log(`\n${passed} passed, ${failed} failed - aborting, no B2 order`);
    process.exit(1);
  }
  const payB2 = await call("POST", "/api/v1/payments/confirm", {
    token: b2.token,
    body: confirmBody(orderB2.json.data, `pay_${STAMP}_b2`)
  });
  check(
    "B2 pays and payment accepted",
    payB2.status === 200 && payB2.json?.data?.status === "PAID",
    JSON.stringify(payB2.json)
  );

  const notifs = kafkaMessages("notification.email").filter(
    (m) => m.data && m.data.auctionId === a1
  );
  check(
    "fallback notifications emitted (offer to B2, loss for B3)",
    notifs.some((n) => n.data.type === "WINNER_FALLBACK" && n.data.userId === b2.userId) &&
      notifs.some((n) => n.data.type === "SALE_LOST" && n.data.userId === b3.userId),
    JSON.stringify(notifs.map((n) => `${n.data.type}:${n.data.userId}`))
  );

  const sold1 = await waitStatus(a1, "SOLD", 25000);
  check(
    "auction transitions to SOLD after saga completion",
    Boolean(sold1 && sold1.winningBidderId === b2.userId && sold1.finalPrice === 1200),
    JSON.stringify(sold1)
  );

  await sleep(1800);
  const searchSold = await call("GET", `/api/v1/search?q=${encodeURIComponent(STAMP)}&status=SOLD`);
  const soldHit = (searchSold.json?.data?.results || []).find((i) => i.auctionId === a1);
  check(
    "search reflects SOLD with reassigned winner",
    Boolean(soldHit && soldHit.winningBidderId === b2.userId && soldHit.currentPrice === 1200),
    JSON.stringify(searchSold.json?.data?.results || [])
  );

  // ---- Scenario 2: single bidder never pays -> exhausted -> UNSOLD
  const a2 = await setupAuction(9000, [[b1.token, 1100]]);
  await waitStatus(a2, "ENDED");
  const exhausted = await waitStatus(a2, "UNSOLD", 70000);
  check(
    "saga exhaustion marks auction UNSOLD when no bidders remain",
    Boolean(exhausted),
    `id=${a2}`
  );
  const unsoldEvents = kafkaMessages("auction.unsold").filter(
    (m) => m.data && m.data.auctionId === a2
  );
  check(
    "auction.unsold event emitted exactly once",
    unsoldEvents.length === 1 && unsoldEvents[0].data.reason === "ALL_WINNERS_DECLINED",
    `count=${unsoldEvents.length}`
  );

  // ---- Scenario 3: gateway-reported payment failure triggers immediate fallback
  const a3 = await setupAuction(9000, [
    [b2.token, 1100],
    [b3.token, 1200]
  ]);
  await waitStatus(a3, "ENDED");
  const orderB3c = await createOrderFor(a3, b3.token);
  check("scenario3 B3 order created", Boolean(orderB3c?.json?.data?.orderId), JSON.stringify(orderB3c?.json));

  const failEvent = {
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: `pay_fail_${Date.now()}`,
          order_id: orderB3c.json.data.orderId,
          error_description: "insufficient funds"
        }
      }
    }
  };
  const failRaw = JSON.stringify(failEvent);
  const failedWh = await call("POST", "/api/v1/payments/webhook", {
    raw: failRaw,
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": hmac(WEBHOOK_SECRET, failRaw)
    }
  });

  const fallback3 = await waitFor(() => {
    const events = winnerEventsFor(a3);
    return events.find((e) => e.data.winningBidderId === b2.userId) || null;
  }, 25000);
  check(
    "payment.failed webhook triggers immediate fallback to B2",
    failedWh.status === 200 && Boolean(fallback3 && fallback3.data.finalPrice === 1100),
    JSON.stringify({ wh: failedWh.json, events: winnerEventsFor(a3).map((e) => e.data) })
  );

  const orderB2c = await createOrderFor(a3, b2.token);
  const payB2c = await call("POST", "/api/v1/payments/confirm", {
    token: b2.token,
    body: confirmBody(orderB2c.json.data, `pay_${STAMP}_b2_c`)
  });
  const sold3 = await waitStatus(a3, "SOLD", 25000);
  check(
    "recovered sale completes as SOLD for B2",
    payB2c.status === 200 && Boolean(sold3 && sold3.finalPrice === 1100),
    JSON.stringify({ pay: payB2c.json, sold: sold3 })
  );

  // ---- Stability: no runaway duplicate fallbacks
  await sleep(6000);
  const a1Count = winnerEventsFor(a1).length;
  const a3Count = winnerEventsFor(a3).length;
  check(
    "winner streams stable after settlement (no duplicate offers)",
    a1Count === 2 && a3Count === 2,
    `a1=${a1Count} a3=${a3Count}`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SMOKE CRASH:", err.message);
  process.exit(1);
});

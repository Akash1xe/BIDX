const crypto = require("crypto");
const { execSync } = require("child_process");
const GATEWAY = process.env.SMOKE_GATEWAY_URL || "http://localhost:4000";
const PAYMENT_DIRECT = process.env.SMOKE_PAYMENT_URL || "http://localhost:4005";

const WEBHOOK_SECRET = process.env.SMOKE_WEBHOOK_SECRET || "bidx-dev-webhook-secret";
const KEY_SECRET = process.env.SMOKE_KEY_SECRET || "bidx-dev-key-secret";
const STAMP = `p9-${Date.now()}`;

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
      `docker exec bidx-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic ${topic} --from-beginning --timeout-ms 8000 2>nul`,
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
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    return payload.sub || null;
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

async function main() {
  const healthDirect = await fetch(`${PAYMENT_DIRECT}/api/v1/health`);
  const health = { status: healthDirect.status, json: await healthDirect.json().catch(() => null) };
  check(
    "payment-service healthy in dev mode",
    health.json?.data?.status === "ok" && health.json?.data?.services?.gatewayMode === "dev",
    JSON.stringify(health.json)
  );

  const seller = await registerUser("Pia Payment Seller");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  const winnerB = await registerUser("Walter Winner");
  const loserA = await registerUser("Andy Also Bidder");

  async function createWonAuction(endInMs, firstBidderToken, secondBidderToken) {
    const productRes = await call("POST", "/api/v1/products", {
      token: sellerToken,
      body: {
        name: `${STAMP} Leica M3`,
        description: "payment flow item",
        category: "Cameras",
        condition: "USED",
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

    await call("POST", "/api/v1/bids", {
      token: firstBidderToken,
      body: { auctionId, amount: 1100 }
    });
    await call("POST", "/api/v1/bids", {
      token: secondBidderToken,
      body: { auctionId, amount: 1200 }
    });

    const ended = await waitFor(async () => {
      const r = await call("GET", `/api/v1/auctions/${auctionId}`);
      if (r.json?.data?.status === "ENDED") return r.json.data;
      return null;
    });
    return { auctionId, ended };
  }

  const won = await createWonAuction(9000, loserA.token, winnerB.token);
  check(
    "auction auto-ended with expected winner",
    Boolean(won.auctionId && won.ended && won.ended.winningBidderId === winnerB.userId),
    JSON.stringify(won)
  );

  const wrongWinnerOrder = await waitFor(async () =>
    call("POST", `/api/v1/payments/order/${won.auctionId}`, { token: loserA.token })
  );
  check(
    "non-winner cannot create order",
    wrongWinnerOrder.status === 404,
    JSON.stringify(wrongWinnerOrder.json)
  );

  let orderRes = null;
  const orderReady = await waitFor(async () => {
    const r = await call("POST", `/api/v1/payments/order/${won.auctionId}`, {
      token: winnerB.token
    });
    if (r.status === 201) return r;
    return null;
  }, 20000);
  orderRes = orderReady || (await call("POST", `/api/v1/payments/order/${won.auctionId}`, { token: winnerB.token }));
  const order = orderRes.json?.data;
  check(
    "winner creates order for final price",
    orderRes.status === 201 &&
      order &&
      order.amountMinor === 120000 &&
      order.currency === "INR" &&
      String(order.orderId).startsWith("order_dev_") &&
      order.status === "CREATED",
    JSON.stringify(orderRes.json)
  );

  const dupOrder = await call("POST", `/api/v1/payments/order/${won.auctionId}`, {
    token: winnerB.token
  });
  check(
    "duplicate order creation replays existing",
    dupOrder.status === 201 && dupOrder.json?.data?.replayed === true && dupOrder.json?.data?.orderId === order.orderId,
    JSON.stringify(dupOrder.json)
  );

  const badSig = await call("POST", "/api/v1/payments/confirm", {
    token: winnerB.token,
    body: { orderId: order.orderId, paymentId: "pay_fake123", signature: "deadbeef" }
  });
  check("confirm with invalid signature rejected", badSig.status === 400, JSON.stringify(badSig.json));

  const goodPaymentId = `pay_${Date.now()}_good`;
  const confirm = await call("POST", "/api/v1/payments/confirm", {
    token: winnerB.token,
    body: {
      orderId: order.orderId,
      paymentId: goodPaymentId,
      signature: hmac(KEY_SECRET, `${order.orderId}|${goodPaymentId}`)
    }
  });
  check(
    "valid signature confirms payment PAID",
    confirm.status === 200 && confirm.json?.data?.status === "PAID" && confirm.json?.data?.alreadyPaid === false,
    JSON.stringify(confirm.json)
  );

  const reConfirm = await call("POST", "/api/v1/payments/confirm", {
    token: winnerB.token,
    body: {
      orderId: order.orderId,
      paymentId: goodPaymentId,
      signature: hmac(KEY_SECRET, `${order.orderId}|${goodPaymentId}`)
    }
  });
  check(
    "double confirm is idempotent",
    reConfirm.status === 200 && reConfirm.json?.data?.alreadyPaid === true,
    JSON.stringify(reConfirm.json)
  );

  const paidAgain = await call("POST", `/api/v1/payments/order/${won.auctionId}`, {
    token: winnerB.token
  });
  check("order creation on paid auction conflicts", paidAgain.status === 409, JSON.stringify(paidAgain.json));

  await sleep(1500);
  const successEvents = kafkaMessages("payment.success").filter(
    (m) => m.data && m.data.auctionId === won.auctionId
  );
  check(
    "payment.success emitted exactly once",
    successEvents.length === 1 && successEvents[0].data.amountMinor === 120000,
    `count=${successEvents.length}`
  );
  const notifs = kafkaMessages("notification.email").filter((m) => m.data && m.data.auctionId === won.auctionId);
  check(
    "seller + winner notified of payment",
    notifs.some((n) => n.data.type === "PAYMENT_SUCCESS" && n.data.userId === seller.userId) &&
      notifs.some((n) => n.data.type === "PAYMENT_RECEIPT" && n.data.userId === winnerB.userId),
    JSON.stringify(notifs.map((n) => `${n.data.type}:${n.data.userId}`))
  );

  const mineList = await call("GET", "/api/v1/payments/mine", { token: winnerB.token });
  check(
    "payments/mine lists the paid order",
    mineList.status === 200 &&
      (mineList.json?.data?.items || []).some((p) => p.orderId === order.orderId && p.status === "PAID"),
    JSON.stringify(mineList.json)
  );

  const byAuction = await call("GET", `/api/v1/payments/auction/${won.auctionId}`, {
    token: sellerToken
  });
  check(
    "seller can read auction payment status",
    byAuction.status === 200 && byAuction.json?.data?.status === "PAID",
    JSON.stringify(byAuction.json)
  );

  const won2 = await createWonAuction(9000, winnerB.token, loserA.token);
  check(
    "second auction ended with loserA as winner",
    Boolean(won2.ended && won2.ended.winningBidderId === loserA.userId),
    JSON.stringify({ id: won2.auctionId })
  );

  const order2Ready = await waitFor(async () => {
    const r = await call("POST", `/api/v1/payments/order/${won2.auctionId}`, {
      token: loserA.token
    });
    if (r.status === 201) return r;
    return null;
  }, 20000);
  const order2 = (order2Ready || { json: {} }).json?.data;
  check("second winner creates order", Boolean(order2 && order2.orderId), JSON.stringify(order2Ready?.json));

  const webhookEvent = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_wh_${Date.now()}`,
          order_id: order2.orderId,
          amount: order2.amountMinor
        }
      }
    }
  };
  const webhookBody = JSON.stringify(webhookEvent);
  const webhookSig = hmac(WEBHOOK_SECRET, webhookBody);

  const whBad = await call("POST", "/api/v1/payments/webhook", {
    raw: webhookBody,
    headers: { "Content-Type": "application/json", "x-razorpay-signature": "tampered" }
  });
  check("webhook with tampered signature rejected", whBad.status === 401, JSON.stringify(whBad.json));

  const afterTamper = await call("GET", `/api/v1/payments/auction/${won2.auctionId}`, {
    token: loserA.token
  });
  check(
    "tampered webhook did not mutate state",
    afterTamper.json?.data?.status === "CREATED",
    JSON.stringify(afterTamper.json)
  );

  const whOk = await call("POST", "/api/v1/payments/webhook", {
    raw: webhookBody,
    headers: { "Content-Type": "application/json", "x-razorpay-signature": webhookSig }
  });
  check(
    "verified webhook marks payment PAID via gateway path",
    whOk.status === 200 && whOk.json?.data?.matched === true,
    JSON.stringify(whOk.json)
  );

  const whReplay = await call("POST", "/api/v1/payments/webhook", {
    raw: webhookBody,
    headers: { "Content-Type": "application/json", "x-razorpay-signature": webhookSig }
  });
  const whState = await call("GET", `/api/v1/payments/auction/${won2.auctionId}`, {
    token: loserA.token
  });
  check(
    "duplicate webhook replay stays consistent",
    whReplay.status === 200 &&
      whState.json?.data?.status === "PAID" &&
      whState.json?.data?.paymentId === webhookEvent.payload.payment.entity.id,
    JSON.stringify({ replay: whReplay.json, state: whState.json })
  );

  await sleep(1500);
  const whSuccessCount = kafkaMessages("payment.success").filter(
    (m) => m.data && m.data.auctionId === won2.auctionId
  ).length;
  check("webhook path emits payment.success exactly once", whSuccessCount === 1, `count=${whSuccessCount}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SMOKE CRASH:", err.message);
  process.exit(1);
});

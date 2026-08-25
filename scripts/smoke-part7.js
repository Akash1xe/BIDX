const { execSync } = require("child_process");
const GATEWAY = process.env.SMOKE_GATEWAY_URL || "http://localhost:4000";

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

async function call(method, path, { body, token } = {}, attempt = 0) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(500);
      return call(method, path, { body, token }, attempt + 1);
    }
    throw err;
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function waitFor(fn, timeoutMs = 30000, intervalMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

function kafkaMessages(topic) {
  for (let i = 0; i < 3; i++) {
    try {
      const out = execSync(
        `docker exec bidx-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic ${topic} --from-beginning --timeout-ms 8000 2>nul`,
        { encoding: "utf8", timeout: 20000 }
      );
      const messages = out
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
      if (messages.length > 0 || i === 2) return messages;
    } catch {
      if (i === 2) return [];
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  return [];
}

function injectEvent(topic, key, data) {
  const out = execSync(
    `node scripts/inject-event.js ${topic} ${key === null ? "null" : key} "${JSON.stringify(data).replace(/"/g, '\\"')}"`,
    { encoding: "utf8", timeout: 30000 }
  );
  if (!out.includes("injected")) throw new Error(out.trim());
}

async function registerUser(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}-${Date.now()}-p7@bidx.dev`;
  const password = "Passw0rd!23";
  const sent = await call("POST", "/api/v1/auth/send-otp", { body: { email } });
  await call("POST", "/api/v1/auth/verify-otp", {
    body: { email, otp: sent.json?.data?.devOtp }
  });
  const signup = await call("POST", "/api/v1/auth/signup", {
    body: { name, email, password }
  });
  return { email, password, token: signup.json?.data?.tokens?.accessToken };
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
  const STAMP = Date.now();

  const health0 = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search/health").catch(() => null);
    return r?.json?.data?.status === "ok" ? r.json.data : null;
  }, 120000);
  check("search-service healthy before chaos", Boolean(health0));
  const dlqBaseline = health0?.dlq?.total || 0;

  injectEvent("auction.created", "poison-1", {
    auctionId: `poison-${STAMP}-a`
  });

  const afterPoison1 = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search/health").catch(() => null);
    const byTopic = r?.json?.data?.dlq?.byTopic || {};
    return byTopic["auction.created"] >= 1 ? r.json.data.dlq : null;
  }, 45000);
  check(
    "poison pill retried then parked on DLQ",
    Boolean(afterPoison1),
    JSON.stringify(afterPoison1)
  );

  injectEvent("auction.started", null, {});

  const afterPoison2 = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search/health").catch(() => null);
    const byTopic = r?.json?.data?.dlq?.byTopic || {};
    return byTopic["auction.started"] >= 1 ? r.json.data.dlq : null;
  }, 45000);
  check(
    "second poison pill parked on its own DLQ topic",
    Boolean(afterPoison2),
    JSON.stringify(afterPoison2)
  );

  const parkedCreated = kafkaMessages("auction.created.dlq").pop();
  check(
    "DLQ message preserves original payload and error context",
    Boolean(parkedCreated?.data) &&
      parkedCreated.data.originalTopic === "auction.created" &&
      parkedCreated.data.attempts === 3 &&
      String(parkedCreated.data.errorMessage).includes("InvalidPayload"),
    JSON.stringify(parkedCreated?.data || {}).slice(0, 220)
  );

  const seller = await registerUser("Quinn Queue");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  check("seller registered post-poison", Boolean(sellerToken));

  const productRes = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: {
      name: `Post-Poison Resilience Item ${STAMP}`,
      description: "proves pipeline continues after DLQ parking",
      category: "Toys",
      condition: "NEW",
      images: []
    }
  });
  const productId = productRes.json?.data?.id;

  const auctionRes = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 250,
      minimumIncrement: 25,
      startTime: new Date(Date.now() + 500).toISOString(),
      endTime: new Date(Date.now() + 1800000).toISOString()
    }
  });
  const auctionId = auctionRes.json?.data?.id;
  const started = await call("POST", `/api/v1/auctions/${auctionId}/start`, { token: sellerToken });
  check("post-poison auction started LIVE", started.status === 200);

  const indexed = await waitFor(async () => {
    const r = await call("GET", `/api/v1/search?q=${encodeURIComponent(`resilience ${STAMP}`)}`).catch(() => null);
    return r?.json?.data?.results?.some((x) => x.auctionId === auctionId) ? r : null;
  }, 45000);
  check(
    "valid events flow normally after poison pills",
    Boolean(indexed),
    JSON.stringify(indexed?.json || {})
  );

  const liveStatus = await waitFor(async () => {
    const r = await call("GET", `/api/v1/search?status=LIVE&limit=50`).catch(() => null);
    return (r?.json?.data?.results || []).some((x) => x.auctionId === auctionId) ? true : null;
  }, 30000);
  check("started auction reflects LIVE status in search", Boolean(liveStatus));

  const malformed = kafkaMessages("auction.created");
  check(
    "original topic stream intact (no corruption from injections)",
    malformed.some((m) => m?.data?.auctionId === auctionId)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

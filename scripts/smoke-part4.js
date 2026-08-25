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

async function call(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function kafkaMessages(topic) {
  const attempts = process.env.KAFKA_READ_ATTEMPTS ? Number(process.env.KAFKA_READ_ATTEMPTS) : 3;
  for (let i = 0; i < attempts; i++) {
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
      if (messages.length > 0 || i === attempts - 1) return messages;
    } catch {
      if (i === attempts - 1) return [];
    }
    sleepSync(2000);
  }
  return [];
}

async function registerUser(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}-${Date.now()}@bidx.dev`;
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
  if (!out.includes("modified=1")) {
    throw new Error(`promotion failed: ${out.trim()}`);
  }
}

async function login(email, password) {
  const r = await call("POST", "/api/v1/auth/login", { body: { email, password } });
  return r.json?.data?.tokens?.accessToken;
}

async function main() {
  const seller = await registerUser("Alice Seller");
  check("seller signup works", Boolean(seller.token));
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  check("seller role promoted and re-login works", Boolean(sellerToken));

  const buyer = await registerUser("Bob Buyer");
  check("buyer signup works", Boolean(buyer.token));

  const product = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: {
      name: "Rolex Submariner",
      description: "Classic dive watch, 2019, box included",
      category: "Watches",
      condition: "USED",
      images: ["https://cdn.bidx.dev/rolex-1.jpg"]
    }
  });
  check("product created by seller", product.status === 201, JSON.stringify(product.json));
  const productId = product.json?.data?.id;

  const productAsBuyer = await call("GET", `/api/v1/products/${productId}`, {
    token: buyer.token
  });
  check("product publicly readable", productAsBuyer.status === 200);

  const anonProductCreate = await call("POST", "/api/v1/products", {
    body: { name: "Anon", category: "misc" }
  });
  check("anonymous product creation blocked", anonProductCreate.status === 401);

  const buyerProduct = await call("POST", "/api/v1/products", {
    token: buyer.token,
    body: { name: "Buyer Item", category: "misc" }
  });
  check(
    "non-seller cannot create products",
    buyerProduct.status === 403,
    JSON.stringify(buyerProduct.json)
  );

  const now = Date.now();
  const auction = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 200000,
      minimumIncrement: 5000,
      startTime: new Date(now + 1000).toISOString(),
      endTime: new Date(now + 3600 * 1000).toISOString()
    }
  });
  check("auction created as DRAFT", auction.status === 201 && auction.json?.data?.status === "DRAFT", JSON.stringify(auction.json));
  const auctionId = auction.json?.data?.id;

  const stolenAuction = await call("POST", "/api/v1/auctions", {
    token: buyer.token,
    body: {
      productId,
      startingPrice: 1000,
      minimumIncrement: 100,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60000).toISOString()
    }
  });
  check("cannot auction someone else's product", stolenAuction.status === 403);

  const badSchedule = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 200000,
      minimumIncrement: 5000,
      startTime: new Date(now + 3600 * 1000).toISOString(),
      endTime: new Date(now).toISOString()
    }
  });
  check("endTime before startTime rejected", badSchedule.status === 400);

  const updateLiveLater = async () =>
    call("PUT", `/api/v1/auctions/${auctionId}`, {
      token: sellerToken,
      body: { startingPrice: 250000 }
    });

  const started = await call("POST", `/api/v1/auctions/${auctionId}/start`, {
    token: sellerToken
  });
  check("auction start -> LIVE", started.status === 200 && started.json?.data?.status === "LIVE");

  const doubleStart = await call("POST", `/api/v1/auctions/${auctionId}/start`, {
    token: sellerToken
  });
  check("double start rejected (state machine)", doubleStart.status === 409);

  const editWhileLive = await updateLiveLater();
  check("editing LIVE auction rejected", editWhileLive.status === 409);

  const buyerEnds = await call("POST", `/api/v1/auctions/${auctionId}/end`, {
    token: buyer.token
  });
  check("non-owner cannot end auction", buyerEnds.status === 403);

  const ended = await call("POST", `/api/v1/auctions/${auctionId}/end`, {
    token: sellerToken
  });
  check(
    "auction end with no bids -> UNSOLD",
    ended.status === 200 && ended.json?.data?.status === "UNSOLD"
  );

  const listed = await call("GET", "/api/v1/auctions?status=UNSOLD&category=watches");
  check(
    "list filter status+category finds our auction",
    Array.isArray(listed.json?.data?.items) &&
      listed.json.data.items.some((a) => a.id === auctionId)
  );

  const draft = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId,
      startingPrice: 50000,
      minimumIncrement: 1000,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 2 * 86400000).toISOString()
    }
  });
  const draftId = draft.json?.data?.id;
  const deleted = await call("DELETE", `/api/v1/auctions/${draftId}`, {
    token: sellerToken
  });
  check("DRAFT auction deletable", deleted.status === 200);

  await new Promise((r) => setTimeout(r, 1500));

  const createdEvent = kafkaMessages("auction.created").find(
    (m) => m?.data?.auctionId === auctionId
  );
  check(
    "auction.created event in Kafka",
    Boolean(createdEvent) && createdEvent.data.startingPrice === 200000
  );
  const startedEvent = kafkaMessages("auction.started").find(
    (m) => m?.data?.auctionId === auctionId
  );
  check("auction.started event in Kafka", Boolean(startedEvent));
  const endedEvent = kafkaMessages("auction.ended").find(
    (m) => m?.data?.auctionId === auctionId
  );
  check(
    "auction.ended event has UNSOLD outcome",
    Boolean(endedEvent) &&
      endedEvent.data.outcome === "NO_VALID_BID" &&
      endedEvent.data.winningBidderId === null
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

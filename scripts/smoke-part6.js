const { execSync } = require("child_process");
const { io } = require("socket.io-client");
const GATEWAY = process.env.SMOKE_GATEWAY_URL || "http://localhost:4000";
const BIDDING = process.env.SMOKE_BIDDING_URL || "http://localhost:4004";

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

async function waitFor(fn, timeoutMs = 25000, intervalMs = 1000) {
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

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BIDDING, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(new Error(err.message)));
    setTimeout(() => reject(new Error("socket connect timeout")), 9000);
  });
}

function waitForEvent(socket, event, predicate, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate || predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });
}

async function main() {
  const seller = await registerUser("Sam Seller");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);

  const bidder1 = await registerUser("Bianca Bidder");
  const bidder2 = await registerUser("Bruno Bidder");
  check("users registered", Boolean(sellerToken && bidder1.token && bidder2.token));

  const productRes = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: {
      name: "Fender Stratocaster 1969",
      description: "Vintage guitar, all original parts",
      category: "Music",
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
      endTime: new Date(now + 3600 * 1000).toISOString()
    }
  });
  const auctionId = auctionRes.json?.data?.id;
  const started = await call("POST", `/api/v1/auctions/${auctionId}/start`, { token: sellerToken });
  check("auction prepared LIVE", started.status === 200, JSON.stringify(auctionRes.json));

  const anonBid = await call("POST", "/api/v1/bids", {
    body: { auctionId, amount: 1100 }
  });
  check("anonymous bid blocked", anonBid.status === 401, JSON.stringify(anonBid.status));

  const sellerBid = await call("POST", "/api/v1/bids", {
    token: sellerToken,
    body: { auctionId, amount: 1100 }
  });
  check(
    "seller cannot bid on own auction",
    sellerBid.status === 403,
    JSON.stringify(sellerBid.json)
  );

  const lowBid = await call("POST", "/api/v1/bids", {
    token: bidder1.token,
    body: { auctionId, amount: 900 }
  });
  check("bid below startingPrice rejected", lowBid.status === 400, JSON.stringify(lowBid.json));

  const firstBid = await call("POST", "/api/v1/bids", {
    token: bidder1.token,
    headers: { "Idempotency-Key": `idem-${auctionId}-first` },
    body: { auctionId, amount: 1100 }
  });
  check(
    "valid opening bid accepted",
    firstBid.status === 201 && firstBid.json?.data?.auction?.currentBid === 1100,
    JSON.stringify(firstBid.json)
  );
  const firstBidId = firstBid.json?.data?.bid?.id;

  const replay = await call("POST", "/api/v1/bids", {
    token: bidder1.token,
    headers: { "Idempotency-Key": `idem-${auctionId}-first` },
    body: { auctionId, amount: 1100 }
  });
  check(
    "idempotent replay returns original without side effects",
    replay.status === 200 &&
      replay.json?.data?.replayed === true &&
      replay.json?.data?.bid?.id === firstBidId,
    JSON.stringify(replay.json)
  );

  const equalBid = await call("POST", "/api/v1/bids", {
    token: bidder2.token,
    body: { auctionId, amount: 1100 }
  });
  check("equal bid rejected (must beat current)", equalBid.status === 400);

  const tinyIncrement = await call("POST", "/api/v1/bids", {
    token: bidder2.token,
    body: { auctionId, amount: 1150 }
  });
  check(
    "insufficient increment rejected",
    tinyIncrement.status === 400 &&
      String(tinyIncrement.json?.message || "").includes("1200"),
    JSON.stringify(tinyIncrement.json)
  );

  const exactIncrement = await call("POST", "/api/v1/bids", {
    token: bidder2.token,
    body: { auctionId, amount: 1200 }
  });
  check(
    "exact minimum increment accepted",
    exactIncrement.status === 201 && exactIncrement.json?.data?.auction?.currentBid === 1200,
    JSON.stringify(exactIncrement.json)
  );

  const history = await call("GET", `/api/v1/bids/auction/${auctionId}`, { token: bidder1.token });
  const historyAmounts = (history.json?.data?.items || []).map((b) => b.amount);
  check(
    "bid history sorted highest-first",
    history.status === 200 &&
      historyAmounts[0] === 1200 &&
      historyAmounts.includes(1100),
    JSON.stringify(historyAmounts)
  );

  const product2 = await call("POST", "/api/v1/products", {
    token: sellerToken,
    body: { name: "Draft Item", category: "Misc", condition: "NEW", images: [] }
  });
  const draftAuction = await call("POST", "/api/v1/auctions", {
    token: sellerToken,
    body: {
      productId: product2.json?.data?.id,
      startingPrice: 500,
      minimumIncrement: 50,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 2 * 86400000).toISOString()
    }
  });
  const draftBid = await call("POST", "/api/v1/bids", {
    token: bidder1.token,
    body: { auctionId: draftAuction.json?.data?.id, amount: 600 }
  });
  check("bidding on non-LIVE auction rejected", draftBid.status === 409, JSON.stringify(draftBid.status));

  const RACE_AMOUNT = 3000;
  const raceResults = await Promise.all([
    call("POST", "/api/v1/bids", {
      token: bidder1.token,
      headers: { "Idempotency-Key": `race-1-${auctionId}` },
      body: { auctionId, amount: RACE_AMOUNT }
    }),
    call("POST", "/api/v1/bids", {
      token: bidder2.token,
      headers: { "Idempotency-Key": `race-2-${auctionId}` },
      body: { auctionId, amount: RACE_AMOUNT }
    }),
    call("POST", "/api/v1/bids", {
      token: bidder1.token,
      headers: { "Idempotency-Key": `race-3-${auctionId}` },
      body: { auctionId, amount: RACE_AMOUNT }
    })
  ]);
  const raceWinners = raceResults.filter((r) => r.status === 201);
  check(
    "concurrent identical bids: exactly one wins (lock serializes)",
    raceWinners.length === 1 &&
      raceResults.every((r) => [201, 400].includes(r.status)),
    JSON.stringify(raceResults.map((r) => r.status))
  );

  const ladder = await Promise.all(
    [3100, 3200, 3300].map((amount, i) =>
      call("POST", "/api/v1/bids", {
        token: i % 2 === 0 ? bidder2.token : bidder1.token,
        headers: { "Idempotency-Key": `ladder-${amount}-${auctionId}` },
        body: { auctionId, amount }
      }).catch(() => ({ status: 0 }))
    )
  );
  const ladderAccepted = ladder.filter((r) => r.status === 201).length;
  const auctionAfterRace = await call("GET", `/api/v1/auctions/${auctionId}`);
  const finalCurrentBid = auctionAfterRace.json?.data?.currentBid;
  check(
    "racing ascending bids converge to correct max",
    finalCurrentBid === 3300 &&
      ladder.every((r) => [0, 201, 400].includes(r.status)) &&
      ladderAccepted >= 1,
    JSON.stringify({ finalCurrentBid, statuses: ladder.map((r) => r.status) })
  );

  let socket1;
  try {
    socket1 = await connectSocket(bidder1.token);
    check("socket connects with valid JWT", socket1.connected);
  } catch (err) {
    check("socket connects with valid JWT", false, err.message);
  }

  try {
    await connectSocket("not-a-real-token");
    check("socket rejects invalid JWT", false, "connection unexpectedly succeeded");
  } catch (err) {
    check("socket rejects invalid JWT", /unauthorized/i.test(err.message), err.message);
  }

  if (socket1) {
    const joined = await new Promise((resolve) => {
      socket1.emit("auction:join", auctionId, (ack) => resolve(ack));
      setTimeout(() => resolve(null), 3000);
    });
    check("socket joins auction room", Boolean(joined?.joined), JSON.stringify(joined));

    const bump = await call("POST", "/api/v1/bids", {
      token: bidder1.token,
      body: { auctionId, amount: 3400 }
    });
    check("pre-socket-event bid placed (bidder1 highest)", bump.status === 201, JSON.stringify(bump.json?.message));

    const newEventPromise = waitForEvent(
      socket1,
      "bid:new",
      (p) => p.auctionId === auctionId && p.amount === 3500
    );
    const outbidPromise = waitForEvent(
      socket1,
      "bid:outbid",
      (p) => p.auctionId === auctionId
    );
    await sleep(300);
    const socketEraBid = await call("POST", "/api/v1/bids", {
      token: bidder2.token,
      body: { auctionId, amount: 3500 }
    });

    const newEvent = await newEventPromise;
    const outbidEvent = await outbidPromise;

    check(
      "room subscriber receives bid:new in real time",
      socketEraBid.status === 201 && Boolean(newEvent),
      JSON.stringify({ status: socketEraBid.status, newEvent })
    );
    check(
      "previous high bidder receives bid:outbid",
      Boolean(outbidEvent),
      JSON.stringify(outbidEvent)
    );
    socket1.disconnect();
  }

  const placedEvents = kafkaMessages("bid.placed").filter((m) => m?.data?.auctionId === auctionId);
  check("bid.placed events published to Kafka", placedEvents.length > 0);
  const acceptedEvents = kafkaMessages("bid.accepted").filter((m) => m?.data?.auctionId === auctionId);
  check(
    "bid.accepted events carry newCurrentBid",
    acceptedEvents.length > 0 && acceptedEvents.some((m) => m.data.newCurrentBid === 3500),
    JSON.stringify(acceptedEvents.length)
  );

  const mine = await call("GET", "/api/v1/bids/mine", { token: bidder2.token });
  check(
    "my-bids listing works",
    mine.status === 200 && (mine.json?.data?.items || []).some((b) => b.amount === 3500),
    JSON.stringify(mine.json?.data?.pagination)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

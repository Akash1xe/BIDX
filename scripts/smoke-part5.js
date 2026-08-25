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
  let last;
  while (Date.now() - startedAt < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last === undefined ? null : last;
}

function esGet(path) {
  try {
    const out = execSync(`docker exec bidx-elasticsearch curl -s http://localhost:9200${path}`, {
      encoding: "utf8",
      timeout: 15000
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function esDoc(auctionId) {
  return esGet(`/auctions/_doc/${auctionId}`);
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

async function createProduct(token, name, category) {
  const r = await call("POST", "/api/v1/products", {
    token,
    body: {
      name,
      description: `${name} - listed via smoke-part5`,
      category,
      condition: "USED",
      images: [`https://cdn.bidx.dev/${encodeURIComponent(name)}.jpg`]
    }
  });
  if (r.status !== 201) throw new Error(`product create failed: ${JSON.stringify(r.json)}`);
  return r.json.data.id;
}

async function createAuction(token, productId, startingPrice) {
  const now = Date.now();
  const r = await call("POST", "/api/v1/auctions", {
    token,
    body: {
      productId,
      startingPrice,
      minimumIncrement: 100,
      startTime: new Date(now + 500).toISOString(),
      endTime: new Date(now + 3600 * 1000).toISOString()
    }
  });
  if (r.status !== 201) throw new Error(`auction create failed: ${JSON.stringify(r.json)}`);
  return r.json.data.id;
}

async function main() {
  const STAMP = Date.now();
  const cluster = esGet("/_cluster/health");
  check(
    "Elasticsearch cluster reachable",
    Boolean(cluster) && ["green", "yellow"].includes(cluster.cluster_name ? cluster.status : ""),
    JSON.stringify(cluster)
  );

  const health = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search/health").catch(() => null);
    return r?.json?.data?.status === "ok" ? r : null;
  }, 120000);
  check("search-service health reports ok (ES + Kafka)", Boolean(health));

  const seller = await registerUser("Sara Searcher");
  promoteToSeller(seller.email);
  const sellerToken = await login(seller.email, seller.password);
  check("seller registered and promoted", Boolean(sellerToken));

  const cameraProduct1 = await createProduct(sellerToken, `Vintage Nikon F3 Camera ${STAMP}`, "Cameras");
  const cameraProduct2 = await createProduct(sellerToken, `Canon AE-1 Camera Body ${STAMP}`, "Cameras");

  const auctionA = await createAuction(sellerToken, cameraProduct1, 1200);
  const auctionB = await createAuction(sellerToken, cameraProduct2, 3000);

  const startA = await call("POST", `/api/v1/auctions/${auctionA}/start`, { token: sellerToken });
  const startB = await call("POST", `/api/v1/auctions/${auctionB}/start`, { token: sellerToken });
  check("both auctions started LIVE", startA.status === 200 && startB.status === 200);

  const indexedA = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search?q=nikon").catch(() => null);
    return r?.json?.data?.results?.some((x) => x.auctionId === auctionA) ? r : null;
  });
  check(
    "full-text search indexes new auctions end-to-end",
    Boolean(indexedA),
    JSON.stringify(indexedA?.json || {})
  );
  check(
    "relevance scoring present on text match",
    typeof indexedA?.json?.data?.results?.find((x) => x.auctionId === auctionA)?.score === "number"
  );

  const suggestions = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search/suggest?q=nikon").catch(() => null);
    return r?.json?.data?.suggestions?.some((x) => x.auctionId === auctionA) ? r : null;
  });
  check("suggest endpoint returns prefix matches", Boolean(suggestions));

  const byCategory = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search?category=cameras&sort=newest&limit=50").catch(() => null);
    const ids = (r?.json?.data?.results || []).map((x) => x.auctionId);
    return ids.includes(auctionA) && ids.includes(auctionB) ? r : null;
  }, 45000);
  const catIds = (byCategory?.json?.data?.results || []).map((x) => x.auctionId);
  check("category filter returns both camera auctions", catIds.includes(auctionA) && catIds.includes(auctionB));

  const wrongCategory = await call("GET", "/api/v1/search?category=watches");
  check(
    "other-category results exclude our auctions",
    !(wrongCategory.json?.data?.results || []).some((x) => x.auctionId === auctionA)
  );

  const priceBand = await call("GET", "/api/v1/search?minPrice=1000&maxPrice=1500");
  const bandIds = (priceBand.json?.data?.results || []).map((x) => x.auctionId);
  check("price range keeps cheap auction", bandIds.includes(auctionA) && !bandIds.includes(auctionB));

  const sortedAsc = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search?category=cameras&sort=price_asc&limit=50").catch(() => null);
    const ours = (r?.json?.data?.results || []).filter((x) => [auctionA, auctionB].includes(x.auctionId));
    return ours.length === 2 ? ours.map((x) => x.startingPrice) : null;
  }, 45000);
  check(
    "sort=price_asc orders cheapest first",
    Array.isArray(sortedAsc) && sortedAsc[0] === 1200 && sortedAsc[1] === 3000,
    JSON.stringify(sortedAsc)
  );

  const paginated = await call("GET", "/api/v1/search?category=cameras&page=1&limit=1");
  check(
    "pagination respects limit and exposes total",
    paginated.json?.data?.results?.length === 1 &&
      paginated.json?.data?.pagination?.total >= 2 &&
      paginated.json?.data?.pagination?.page === 1,
    JSON.stringify(paginated.json?.data?.pagination)
  );

  const faceted = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search?q=camera").catch(() => null);
    const bucket = r?.json?.data?.facets?.categories?.find((b) => b.value === "cameras");
    return bucket && bucket.count >= 2 ? bucket : null;
  });
  check("category facets aggregate counts", Boolean(faceted), JSON.stringify(faceted));

  const secretName = `Unlisted Secret Painting ${Date.now()}`;
  const secretProduct = await createProduct(sellerToken, secretName, "Art");
  const draftAuction = await createAuction(sellerToken, secretProduct, 99999);

  const draftIndexed = await waitFor(() => {
    const doc = esDoc(draftAuction);
    return doc?.found === true ? doc : null;
  });
  check(
    "DRAFT auction is indexed internally",
    Boolean(draftIndexed),
    JSON.stringify(draftIndexed || {}).slice(0, 200)
  );

  const draftHidden = await call("GET", `/api/v1/search?q=${encodeURIComponent(secretName)}`);
  check(
    "DRAFT auctions never publicly searchable",
    (draftHidden.json?.data?.results || []).length === 0,
    JSON.stringify(draftHidden.json?.data?.results)
  );

  const reprice = await call("PUT", `/api/v1/auctions/${draftAuction}`, {
    token: sellerToken,
    body: { startingPrice: 7777 }
  });
  check("draft repricing accepted", reprice.status === 200);

  const repriceIndexed = await waitFor(() => {
    const doc = esDoc(draftAuction);
    return doc?._source?.startingPrice === 7777 ? doc : null;
  });
  check("auction.updated event reindexes document", Boolean(repriceIndexed), JSON.stringify(repriceIndexed || {}));

  const removed = await call("DELETE", `/api/v1/auctions/${draftAuction}`, { token: sellerToken });
  check("draft deletion accepted", removed.status === 200);

  const deletionIndexed = await waitFor(() => {
    const doc = esDoc(draftAuction);
    return doc && doc.found === false ? true : null;
  });
  check("auction.deleted event removes document", Boolean(deletionIndexed));

  const liveOnly = await call("GET", "/api/v1/search?status=LIVE&limit=50");
  const liveIds = (liveOnly.json?.data?.results || []).map((x) => x.auctionId);
  check("status=LIVE filter shows running auctions", liveIds.includes(auctionA) && liveIds.includes(auctionB));

  const ended = await call("POST", `/api/v1/auctions/${auctionA}/end`, { token: sellerToken });
  check("ending auction works", ended.status === 200 && ended.json?.data?.status === "UNSOLD");

  const unsoldVisible = await waitFor(async () => {
    const r = await call("GET", "/api/v1/search?status=UNSOLD&limit=50").catch(() => null);
    return (r?.json?.data?.results || []).some((x) => x.auctionId === auctionA) ? r : null;
  });
  check(
    "ended -> UNSOLD status reflected in search",
    Boolean(unsoldVisible),
    JSON.stringify(unsoldVisible?.json?.data?.results?.slice(0, 2))
  );

  const badQuery = await call("GET", "/api/v1/search?minPrice=abc");
  check("invalid numeric filter rejected with 400", badQuery.status === 400);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

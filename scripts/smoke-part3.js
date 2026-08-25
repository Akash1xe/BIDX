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

async function call(method, path, { body, token, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const startedAt = Date.now();
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, latencyMs: Date.now() - startedAt, res };
}

async function main() {
  const health = await call("GET", "/health");
  check("gateway health returns 200", health.status === 200);
  check(
    "gateway health lists routes and circuits",
    Array.isArray(health.json?.data?.routes) && Array.isArray(health.json?.data?.circuits)
  );
  check("request-id header present", Boolean(health.res.headers.get("x-request-id")));

  const email = `gw-${Date.now()}@bidx.dev`;
  const password = "Passw0rd!23";

  const sent = await call("POST", "/api/v1/auth/send-otp", { body: { email } });
  check("proxied send-otp works", sent.status === 200, JSON.stringify(sent.json));
  check("rate limit headers exposed at gateway", sent.res.headers.get("ratelimit-limit") === "300");
  const otp = sent.json?.data?.devOtp;

  await call("POST", "/api/v1/auth/verify-otp", { body: { email, otp } });
  const signup = await call("POST", "/api/v1/auth/signup", {
    body: { name: "Gateway Tester", email, password }
  });
  check("proxied signup works", signup.status === 201, JSON.stringify(signup.json));
  const accessToken = signup.json?.data?.tokens?.accessToken;

  const me = await call("GET", "/api/v1/users/me", { token: accessToken });
  check("protected route proxies with valid token", me.status === 200 && me.json?.data?.user?.email === email);

  const noAuth = await call("GET", "/api/v1/users/me");
  check("protected route blocked at edge without token", noAuth.status === 401);

  const badToken = await call("GET", "/api/v1/users/me", { token: "garbage.token.here" });
  check("invalid token rejected at edge", badToken.status === 401);

  const wrongPw = await call("POST", "/api/v1/auth/login", {
    body: { email, password: "WrongPassword!1" }
  });
  check(
    "upstream error status propagates through gateway",
    wrongPw.status === 401 && wrongPw.json?.success === false
  );

  let sawOpenCircuit = false;
  let openCircuitFast = false;
  for (let i = 0; i < 8; i += 1) {
    const r = await call("GET", "/api/v1/auctions");
    if (r.status === 503 && String(r.json?.message || "").includes("temporarily unavailable")) {
      sawOpenCircuit = true;
      openCircuitFast = r.latencyMs < 100;
      break;
    }
  }
  check("circuit opens for downed auction-service", sawOpenCircuit);
  check("open circuit fails fast (<100ms)", openCircuitFast);

  const retryAfter = (await call("GET", "/api/v1/auctions")).res.headers.get("retry-after");
  check("Retry-After exposed when circuit open", Boolean(retryAfter));

  const unknownRoute = await call("GET", "/api/v1/unknown");
  check("unregistered prefix returns 404 from gateway", unknownRoute.status === 404);

  const rootNotFound = await call("GET", "/definitely/not/here");
  check("non-api path handled by gateway 404", rootNotFound.status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

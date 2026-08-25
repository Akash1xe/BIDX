const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4001/api/v1";

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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const email = `smoke-${Date.now()}@bidx.dev`;
  const password = "Passw0rd!23";

  const sent = await call("POST", "/auth/send-otp", { body: { email } });
  check("send-otp returns 200", sent.status === 200, JSON.stringify(sent.json));
  const otp = sent.json?.data?.devOtp;
  check("send-otp exposes devOtp in development", Boolean(otp));

  const throttled = await call("POST", "/auth/send-otp", { body: { email } });
  check("send-otp throttled on immediate resend", throttled.status === 429);

  const verified = await call("POST", "/auth/verify-otp", { body: { email, otp } });
  check("verify-otp returns 200", verified.status === 200, JSON.stringify(verified.json));

  const badVerify = await call("POST", "/auth/verify-otp", {
    body: { email: `other-${Date.now()}@bidx.dev`, otp: "000000" }
  });
  check("verify-otp rejects unknown/expired otp", badVerify.status === 400);

  const noSignup = await call("POST", "/auth/signup", {
    body: { name: "Skip Verify", email: `skip-${Date.now()}@bidx.dev`, password }
  });
  check("signup without OTP verification forbidden", noSignup.status === 403);

  const signup = await call("POST", "/auth/signup", {
    body: { name: "Smoke Tester", email, password }
  });
  check("signup returns 201", signup.status === 201, JSON.stringify(signup.json));
  const accessToken = signup.json?.data?.tokens?.accessToken;
  const refreshToken = signup.json?.data?.tokens?.refreshToken;
  check("signup issues both tokens", Boolean(accessToken && refreshToken));

  const dupSignup = await call("POST", "/auth/signup", {
    body: { name: "Dup", email, password }
  });
  check("duplicate signup conflicts", dupSignup.status === 409 || dupSignup.status === 403);

  const me1 = await call("GET", "/users/me", { token: accessToken });
  check("GET /users/me works", me1.status === 200 && me1.json?.data?.user?.email === email);
  check("first profile read is a miss", me1.json?.data?.fromCache === false);

  const me2 = await call("GET", "/users/me", { token: accessToken });
  check("second profile read is cached", me2.json?.data?.fromCache === true);

  const updated = await call("PUT", "/users/me", {
    token: accessToken,
    body: { name: "Renamed Tester" }
  });
  check("PUT /users/me updates name", updated.json?.data?.user?.name === "Renamed Tester");

  const me3 = await call("GET", "/users/me", { token: accessToken });
  check(
    "cache invalidated after update",
    me3.json?.data?.fromCache === false && me3.json?.data?.user?.name === "Renamed Tester"
  );

  const unauth = await call("GET", "/users/me");
  check("GET /users/me without token is 401", unauth.status === 401);

  const login = await call("POST", "/auth/login", { body: { email, password } });
  check("login returns 200", login.status === 200, JSON.stringify(login.json));
  const loginRefresh = login.json?.data?.tokens?.refreshToken;

  const badLogin = await call("POST", "/auth/login", {
    body: { email, password: "WrongPassword!1" }
  });
  check("login with wrong password is 401", badLogin.status === 401);

  const rotate1 = await call("POST", "/auth/refresh", { body: { refreshToken } });
  check("refresh rotation succeeds", rotate1.status === 200, JSON.stringify(rotate1.json));

  const rotateReuse = await call("POST", "/auth/refresh", { body: { refreshToken } });
  check(
    "reusing rotated refresh token triggers 401",
    rotateReuse.status === 401 &&
      String(rotateReuse.json?.message || "").includes("reuse")
  );

  const afterRevoke = await call("POST", "/auth/refresh", {
    body: { refreshToken: rotate1.json?.data?.tokens?.refreshToken }
  });
  check("token family revoked after reuse detection", afterRevoke.status === 401);

  const login2 = await call("POST", "/auth/login", { body: { email, password } });
  const freshAccess = login2.json?.data?.tokens?.accessToken;

  const logoutRes = await call("POST", "/auth/logout", {
    body: { refreshToken: loginRefresh || login2.json?.data?.tokens?.refreshToken }
  });
  check("logout returns 200", logoutRes.status === 200);

  const postLogout = await call("GET", "/users/me", { token: freshAccess });
  check("access token remains valid until expiry", postLogout.status === 200);

  let sawRateLimit = false;
  for (let i = 0; i < 15; i += 1) {
    const r = await call("POST", "/auth/login", {
      body: { email, password: "WrongPassword!1" }
    });
    if (r.status === 429) {
      sawRateLimit = true;
      break;
    }
  }
  check("rate limiter kicks in with 429", sawRateLimit);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

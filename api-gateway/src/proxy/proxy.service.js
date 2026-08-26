const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "upgrade",
  "proxy-authenticate", "proxy-authorization", "te", "trailer"
]);
const SKIPPED = new Set(["host", "content-length"]);

class UpstreamUnavailableError extends Error {
  constructor(target, cause) {
    super(`Upstream unavailable: ${target}`);
    this.name = "UpstreamUnavailableError";
    this.target = target;
    this.cause = cause;
  }
}

class UpstreamTimeoutError extends Error {
  constructor(target, timeoutMs) {
    super(`Upstream timed out after ${timeoutMs}ms: ${target}`);
    this.name = "UpstreamTimeoutError";
    this.target = target;
  }
}

function buildForwardHeaders(req, extraHeaders = {}) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && !SKIPPED.has(lower)) headers[lower] = value;
  }
  Object.assign(headers, extraHeaders);
  return headers;
}

function responseHeaders(response) {
  const headers = {};
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  if (setCookies.length) headers["set-cookie"] = setCookies;
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) headers["retry-after"] = retryAfter;
  return headers;
}

async function forward(req, targetBaseUrl, { timeoutMs = 8000, extraHeaders = {} } = {}) {
  const url = `${targetBaseUrl.replace(/\/$/, "")}${req.originalUrl}`;
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const rawBody = Buffer.isBuffer(req.body);
  const body = hasBody ? (rawBody ? req.body : JSON.stringify(req.body ?? {})) : undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildForwardHeaders(req, {
        ...extraHeaders,
        ...(hasBody && !rawBody ? { "content-type": "application/json" } : {})
      }),
      body,
      signal: controller.signal,
      redirect: "manual"
    });
  } catch (error) {
    if (error.name === "AbortError") throw new UpstreamTimeoutError(url, timeoutMs);
    throw new UpstreamUnavailableError(url, error);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, body: data, headers: responseHeaders(response) };
}

module.exports = { forward, buildForwardHeaders, responseHeaders, UpstreamUnavailableError, UpstreamTimeoutError };

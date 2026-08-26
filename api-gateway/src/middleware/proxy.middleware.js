const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");
const { matchRoute } = require("../config/routes");
const { getBreaker, CircuitOpenError } = require("../circuit-breaker/circuit-breaker");
const { forward, UpstreamUnavailableError, UpstreamTimeoutError } = require("../proxy/proxy.service");
const { gatewayAuth } = require("./gateway-auth.middleware");

function demoReadFallback(req, routeConfig) {
  if (!env.demoMode || req.method !== "GET") return null;

  const pathname = req.originalUrl.split("?")[0];
  if (routeConfig.service === "payment" && pathname === "/api/v1/payments/mine") {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    return { items: [], pagination: { page, limit, total: 0 } };
  }
  if (routeConfig.service === "notification" && pathname === "/api/v1/notifications/mine") {
    return [];
  }
  return null;
}

function sendDemoFallback(res, data) {
  res.setHeader("X-BidX-Demo-Fallback", "true");
  return res.status(200).json({ success: true, data });
}

function proxyHandler(req, res, next) {
  const routePath = req.originalUrl.split("?")[0];
  const routeConfig = matchRoute(routePath);
  if (!routeConfig) throw ApiError.notFound(`No route registered for ${req.method} ${routePath}`);

  gatewayAuth(routeConfig)(req, res, async (error) => {
    if (error) return next(error);
    const breaker = getBreaker(routeConfig.service);
    try {
      const result = await breaker.exec(() => forward(req, routeConfig.target, {
        timeoutMs: env.upstreamTimeoutMs,
        extraHeaders: { "x-request-id": req.requestId, "x-forwarded-by": "bidx-api-gateway" }
      }));
      const fallback = demoReadFallback(req, routeConfig);
      if (fallback !== null && result.status >= 500) return sendDemoFallback(res, fallback);
      for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
      if (result.body === null || result.body === undefined) return res.status(result.status).end();
      if (typeof result.body === "object") return res.status(result.status).json(result.body);
      return res.status(result.status).send(result.body);
    } catch (err) {
      const fallback = demoReadFallback(req, routeConfig);
      if (fallback !== null && (
        err instanceof CircuitOpenError ||
        err instanceof UpstreamUnavailableError ||
        err instanceof UpstreamTimeoutError
      )) return sendDemoFallback(res, fallback);

      if (err instanceof CircuitOpenError) {
        res.setHeader("Retry-After", Math.ceil(err.retryAfterMs / 1000));
        return next(ApiError.serviceUnavailable(`Service '${routeConfig.service}' is temporarily unavailable`));
      }
      if (err instanceof UpstreamUnavailableError || err instanceof UpstreamTimeoutError) {
        console.error(`${err.name}: ${err.message}`);
        return next(ApiError.badGateway("Upstream service error"));
      }
      return next(err);
    }
  });
}

module.exports = { proxyHandler, demoReadFallback };

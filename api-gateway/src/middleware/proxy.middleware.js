const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");
const { matchRoute } = require("../config/routes");
const { getBreaker, CircuitOpenError } = require("../circuit-breaker/circuit-breaker");
const { forward, UpstreamUnavailableError, UpstreamTimeoutError } = require("../proxy/proxy.service");
const { gatewayAuth } = require("./gateway-auth.middleware");

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
      for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
      if (result.body === null || result.body === undefined) return res.status(result.status).end();
      if (typeof result.body === "object") return res.status(result.status).json(result.body);
      return res.status(result.status).send(result.body);
    } catch (err) {
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

module.exports = { proxyHandler };

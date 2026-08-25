const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");
const { matchRoute } = require("../config/routes");
const { getBreaker, CircuitOpenError } = require("../circuit-breaker/circuit-breaker");
const { forward, UpstreamUnavailableError, UpstreamTimeoutError } = require("../proxy/proxy.service");
const { gatewayAuth } = require("./gateway-auth.middleware");

function proxyHandler(req, res, next) {
  const routePath = req.originalUrl.split("?")[0];
  const routeConfig = matchRoute(routePath);
  if (!routeConfig) {
    throw ApiError.notFound(`No route registered for ${req.method} ${routePath}`);
  }

  gatewayAuth(routeConfig)(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    const breaker = getBreaker(routeConfig.service);

    try {
      const result = await breaker.exec(() =>
        forward(req, routeConfig.target, {
          timeoutMs: env.upstreamTimeoutMs,
          extraHeaders: { "x-request-id": req.requestId, "x-forwarded-by": "bidx-api-gateway" }
        })
      );
      return res.status(result.status).json(result.body);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        res.setHeader("Retry-After", Math.ceil(error.retryAfterMs / 1000));
        return next(
          ApiError.serviceUnavailable(`Service '${routeConfig.service}' is temporarily unavailable`)
        );
      }
      if (
        error instanceof UpstreamUnavailableError ||
        error instanceof UpstreamTimeoutError
      ) {
        console.error(`${error.name}: ${error.message}`);
        return next(ApiError.badGateway(`Upstream service error`));
      }
      return next(error);
    }
  });
}

module.exports = { proxyHandler };

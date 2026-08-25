const { ApiResponse } = require("@bidx/shared/utils/api-response");
const { breakerSummary } = require("../circuit-breaker/circuit-breaker");
const { ROUTES } = require("../config/routes");

function gatewayHealth(req, res) {
  const body = {
    status: "ok",
    service: "api-gateway",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    routes: ROUTES.map((route) => ({
      prefix: route.prefix,
      service: route.service,
      auth: route.auth
    })),
    circuits: breakerSummary()
  };
  return ApiResponse.success(res, { message: "Gateway healthy", data: body });
}

module.exports = { gatewayHealth };

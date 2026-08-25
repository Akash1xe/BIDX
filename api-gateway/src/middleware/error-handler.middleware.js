const { ApiError } = require("@bidx/shared/errors/api-error");
const env = require("../config/env");

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details;

  if (!(err instanceof ApiError)) {
    if (err.type === "entity.parse.failed") {
      statusCode = 400;
      message = "Malformed JSON body";
    } else if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid or expired token";
    }
  }

  const payload = {
    success: false,
    requestId: req.requestId,
    message,
    ...(details !== undefined ? { details } : {})
  };

  if (statusCode >= 500) {
    console.error(`[${req.requestId}]`, err.stack || message);
  }

  res.status(statusCode).json(
    env.isProduction && statusCode >= 500 && err.isOperational === false
      ? { success: false, requestId: req.requestId, message: "Internal Server Error" }
      : payload
  );
}

module.exports = { notFoundHandler, errorHandler };

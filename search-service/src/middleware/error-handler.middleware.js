const { ApiError } = require("@bidx/shared");
const env = require("../config/env");

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details;

  if (!(err instanceof ApiError)) {
    if (err.name === "ValidationError") {
      statusCode = 400;
      message = "Validation failed";
      details = Object.values(err.errors).map((e) => e.message);
    } else if (err.meta && err.meta.statusCode) {
      statusCode = err.meta.statusCode >= 500 ? 502 : err.meta.statusCode === 404 ? 404 : 400;
    }
  }

  const payload = {
    success: false,
    message,
    ...(details !== undefined ? { details } : {})
  };

  if (statusCode >= 500) {
    console.error(err.stack || message);
  }

  res.status(statusCode).json(
    env.isProduction && statusCode >= 500
      ? { success: false, message: "Internal Server Error" }
      : payload
  );
}

module.exports = { notFoundHandler, errorHandler };

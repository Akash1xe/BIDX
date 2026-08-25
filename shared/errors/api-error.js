class ApiError extends Error {
  constructor(statusCode, message, details = undefined, isOperational = true) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad Request", details = undefined) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized", details = undefined) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = "Forbidden", details = undefined) {
    return new ApiError(403, message, details);
  }

  static notFound(message = "Not Found", details = undefined) {
    return new ApiError(404, message, details);
  }

  static conflict(message = "Conflict", details = undefined) {
    return new ApiError(409, message, details);
  }

  static tooManyRequests(message = "Too Many Requests", details = undefined) {
    return new ApiError(429, message, details);
  }

  static internal(message = "Internal Server Error", details = undefined) {
    return new ApiError(500, message, details, false);
  }

  static serviceUnavailable(message = "Service Unavailable", details = undefined) {
    return new ApiError(503, message, details);
  }

  static badGateway(message = "Bad Gateway", details = undefined) {
    return new ApiError(502, message, details, false);
  }
}

module.exports = { ApiError };

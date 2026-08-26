export class ApiClientError extends Error {
  constructor(message, { status = 0, requestId = null, details = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiClientError";
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiClientError) return error;

  const response = error?.response;
  const payload = response?.data;

  if (response) {
    const defaults = {
      401: "Your session has expired. Please sign in again.",
      403: "You do not have permission to perform this action.",
      404: "The requested BidX record was not found.",
      409: "The record changed before your request completed. Refresh and try again.",
      422: "Some submitted values are invalid. Review the form and try again.",
      429: "Too many requests were sent. Wait a moment and try again.",
      500: "BidX could not complete the request. Please try again.",
    };
    return new ApiClientError(
      payload?.message || defaults[response.status] || `Request failed with status ${response.status}`,
      {
        status: response.status,
        requestId: payload?.requestId || response.headers?.["x-request-id"] || null,
        details: payload?.details || null,
        cause: error,
      }
    );
  }

  if (error?.code === "ECONNABORTED") {
    return new ApiClientError("The request timed out. Please try again.", {
      cause: error,
    });
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new ApiClientError("You are offline. Reconnect to continue.", { cause: error });
  }

  return new ApiClientError(
    error?.message || "The server could not be reached.",
    { cause: error }
  );
}

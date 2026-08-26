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
    return new ApiClientError(
      payload?.message || `Request failed with status ${response.status}`,
      {
        status: response.status,
        requestId: payload?.requestId || null,
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

  return new ApiClientError(
    error?.message || "The server could not be reached.",
    { cause: error }
  );
}


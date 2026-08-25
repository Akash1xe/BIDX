class ApiResponse {
  static success(res, { data = null, statusCode = 200, message = "OK" } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }
}

module.exports = { ApiResponse };

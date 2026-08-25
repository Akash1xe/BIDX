const logger = require("@bidx/shared/utils/logger");

module.exports = function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path} error: ${err.message}`);
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: err.message });
};

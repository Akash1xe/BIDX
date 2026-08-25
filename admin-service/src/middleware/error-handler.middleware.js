const logger = require("@bidx/shared/utils/logger");

module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error(`${req.method} ${req.path} error: ${err.message}`);
  res.status(status).json({ success: false, error: err.message });
};

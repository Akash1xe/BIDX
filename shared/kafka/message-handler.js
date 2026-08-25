const logger = require("../utils/logger");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a business handler with retry + permanent-failure parking.
 * Offsets commit only after success or parking (at-least-once, no stalls).
 */
function createRetryingHandler({ handle, retries = 3, baseDelayMs = 400, onPermanentFailure }) {
  return async function eachMessage({ topic, partition, message }) {
    if (!message || message.value === null || message.value === undefined) {
      logger.warn(`Skipping empty message on ${topic} [p${partition}]`);
      return;
    }

    const value = message.value.toString();
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await handle({ topic, partition, key: message.key ? message.key.toString() : null, value });
        return;
      } catch (err) {
        lastError = err;
        logger.warn(
          `Handler failed [${topic} p${partition}] attempt ${attempt}/${retries}: ${err.message}`
        );
        if (attempt < retries) {
          await sleep(baseDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    logger.error(`Handler permanently failed [${topic} p${partition}] after ${retries} attempts`);
    try {
      await onPermanentFailure({ topic, partition, value, error: lastError, attempts: retries });
    } catch (parkErr) {
      logger.error(`Parking on DLQ itself failed for ${topic}: ${parkErr.message}`);
    }
  };
}

module.exports = { createRetryingHandler };

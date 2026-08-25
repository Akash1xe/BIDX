const logger = require("@bidx/shared/utils/logger");
const env = require("../config/env");

const STATE = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN"
});

class CircuitOpenError extends Error {
  constructor(name, retryAfterMs) {
    super(`Circuit breaker for '${name}' is open`);
    this.name = "CircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

class CircuitBreaker {
  constructor({ name, failureThreshold = 5, openMs = 10000, halfOpenMaxProbes = 1 }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.halfOpenMaxProbes = halfOpenMaxProbes;

    this.state = STATE.CLOSED;
    this.failures = 0;
    this.openedAt = 0;
    this.halfOpenProbesInFlight = 0;
  }

  get msUntilHalfOpen() {
    return Math.max(0, this.openedAt + this.openMs - Date.now());
  }

  #transition(nextState) {
    if (this.state === nextState) {
      return;
    }
    logger.warn(`Circuit [${this.name}] ${this.state} -> ${nextState}`);
    this.state = nextState;
    if (nextState === STATE.OPEN) {
      this.openedAt = Date.now();
    }
    if (nextState === STATE.CLOSED) {
      this.failures = 0;
    }
  }

  #canAttempt() {
    if (this.state === STATE.CLOSED) {
      return true;
    }
    if (this.state === STATE.OPEN) {
      if (Date.now() - this.openedAt >= this.openMs) {
        this.#transition(STATE.HALF_OPEN);
        this.halfOpenProbesInFlight = 0;
        return true;
      }
      return false;
    }
    return this.halfOpenProbesInFlight < this.halfOpenMaxProbes;
  }

  async exec(operation) {
    if (!this.#canAttempt()) {
      throw new CircuitOpenError(this.name, this.msUntilHalfOpen);
    }

    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenProbesInFlight += 1;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      this.#transition(STATE.CLOSED);
      return;
    }
    if (this.state === STATE.CLOSED) {
      this.failures = 0;
    }
  }

  onFailure() {
    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenProbesInFlight = Math.max(0, this.halfOpenProbesInFlight - 1);
      this.failures += 1;
      if (this.failures >= 1) {
        this.#transition(STATE.OPEN);
      }
      return;
    }
    if (this.state === STATE.CLOSED) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.#transition(STATE.OPEN);
      }
    }
  }
}

const registry = new Map();

function getBreaker(serviceName) {
  if (!registry.has(serviceName)) {
    registry.set(
      serviceName,
      new CircuitBreaker({
        name: serviceName,
        failureThreshold: env.circuitBreaker.failureThreshold,
        openMs: env.circuitBreaker.openMs,
        halfOpenMaxProbes: env.circuitBreaker.halfOpenMaxProbes
      })
    );
  }
  return registry.get(serviceName);
}

function breakerSummary() {
  return Array.from(registry.entries()).map(([name, breaker]) => ({
    name,
    state: breaker.state,
    failures: breaker.failures
  }));
}

module.exports = { getBreaker, breakerSummary, CircuitOpenError, BREAKER_STATES: STATE };

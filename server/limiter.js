'use strict';
class AttemptLimiter {
  constructor({limit = 8, windowMs = 60_000, now = () => Date.now()} = {}) {
    this.limit = limit; this.windowMs = windowMs; this.now = now; this.attempts = new Map();
  }
  allow(key, limit = this.limit) {
    const cutoff = this.now() - this.windowMs;
    const attempts = (this.attempts.get(key) || []).filter(t => t > cutoff);
    if (attempts.length >= limit) { this.attempts.set(key, attempts); return false; }
    attempts.push(this.now()); this.attempts.set(key, attempts);
    return true;
  }
  sweep() {
    const cutoff = this.now() - this.windowMs;
    for (const [key, attempts] of this.attempts) {
      const fresh = attempts.filter(t => t > cutoff);
      if (fresh.length) this.attempts.set(key, fresh); else this.attempts.delete(key);
    }
  }
}
module.exports = {AttemptLimiter};

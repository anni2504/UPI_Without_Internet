import { config } from '../config.js';

class IdempotencyService {
  constructor() {
    this.seen = new Map();
    this._evictionTimer = null;
  }

  start() {
    this._evictionTimer = setInterval(() => this.evictExpired(), 60_000);
    if (this._evictionTimer.unref) this._evictionTimer.unref();
  }

  stop() {
    if (this._evictionTimer) {
      clearInterval(this._evictionTimer);
      this._evictionTimer = null;
    }
  }

  claim(packetHash) {
    if (this.seen.has(packetHash)) {
      return false;
    }
    this.seen.set(packetHash, Date.now());
    return true;
  }

  size() {
    return this.seen.size;
  }

  evictExpired() {
    const cutoff = Date.now() - config.idempotencyTtlSeconds * 1000;
    for (const [hash, seenAt] of this.seen.entries()) {
      if (seenAt < cutoff) {
        this.seen.delete(hash);
      }
    }
  }

  clear() {
    this.seen.clear();
  }
}

export const idempotencyService = new IdempotencyService();

/**
 * Rate limiting middleware.
 *
 * Uses in-memory store (suitable for single-instance).
 * For multi-instance: replace with Redis-backed store.
 */

const stores = new Map();

function getStore(prefix) {
  if (!stores.has(prefix)) {
    stores.set(prefix, new Map());
  }
  return stores.get(prefix);
}

/**
 * Create a rate limiter.
 * @param {object} options
 * @param {number} options.windowMs - Time window in ms
 * @param {number} options.max - Max requests per window
 * @param {function} options.keyGenerator - (req) => string
 * @param {object} options.message - Error response body
 * @returns {function} middleware (req) => { allowed, retryAfter } | null
 */
export function rateLimit({ windowMs, max, keyGenerator, message }) {
  const prefix = `rl_${windowMs}_${max}`;

  return function checkLimit(req) {
    const store = getStore(prefix);
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        status: 429,
        body: message || { error: "Too many requests" },
        headers: { "Retry-After": String(retryAfter) },
      };
    }

    return { allowed: true };
  };
}

// ── Pre-configured limiters ─────────────────────────────────

export const parseCvLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip || "anon",
  message: { error: "Parse limit reached. Try again in an hour." },
});

export const unlockLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req) => req.user?.company_id || req.ip || "anon",
  message: { error: "Unlock limit reached. Try again tomorrow." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req) => req.user?.id || req.ip || "anon",
  message: { error: "Rate limit exceeded. Please slow down." },
});

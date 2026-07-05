import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Keyed by IP+phone (not express-rate-limit's IP-only default) so an attacker can't lock out a
// victim's phone number from a single IP while still being rate-limited per (IP, phone) pair.
// ipKeyGenerator normalizes the IP (required for IPv6 safety by express-rate-limit v8+).
export const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  limit: Number(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.phoneNumber || ''}`,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
});

// Shared factory so ai-integration can build a matching limiter for /ai/* without redefining the
// windowMs/keyGenerator pattern.
export const createRateLimiter = (overrides = {}) =>
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    limit: Number(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5,
    standardHeaders: true,
    legacyHeaders: false,
    ...overrides,
  });

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { retranscribe, translateMessage } from '../controllers/ai.controller.js';

const router = Router();

// Separate limiters, not one shared counter — translation is recipient-requested-on-read, so a
// user reading several messages in a foreign-language chat can easily make more calls per
// session than the default auth-style 5-per-15-min budget (inherited via createRateLimiter's
// defaults) would allow; sharing a counter with /transcribe would also mean unrelated Groq calls
// compete for the same quota. Retranscribe is a manual retry, expected to be rare, so it keeps
// the tighter default. Note: a cache hit on /translate still consumes budget (the limiter runs
// before the controller knows whether it's a hit) — the generous limit accounts for that.
const transcribeLimiter = createRateLimiter({ keyGenerator: (req) => req.user.id });
const translateLimiter = createRateLimiter({ keyGenerator: (req) => req.user.id, limit: 60 });

router.post(
  '/transcribe',
  authenticate,
  transcribeLimiter,
  [body('messageId').isMongoId()],
  validate,
  retranscribe
);

router.post(
  '/translate',
  authenticate,
  translateLimiter,
  [body('messageId').isMongoId(), body('targetLanguage').isString().trim().notEmpty()],
  validate,
  translateMessage
);

export default router;

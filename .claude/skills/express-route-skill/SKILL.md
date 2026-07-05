---
name: express-route-skill
description: Standard route/controller/validation scaffold used for every REST endpoint in backend/src/routes and controllers, so the pattern isn't re-derived per endpoint.
---

# Express route pattern

**Middleware order** in every route file: `rateLimiter (if applicable) -> auth.middleware -> express-validator chain -> validate -> controller`.

```js
// routes/example.routes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { createThing } from '../controllers/example.controller.js';

const router = Router();

router.post(
  '/',
  authenticate,
  [body('name').isString().trim().notEmpty()],
  validate,
  createThing
);

export default router;
```

**Controllers are thin** — orchestration only, wrapped in `asyncHandler` so no route ever needs a manual try/catch:

```js
export const createThing = asyncHandler(async (req, res) => {
  const thing = await thingService.create(req.user.id, req.body);
  res.status(201).json({ thing });
});
```

Business/data logic lives in a service (`services/`) or a model static, not inline in the controller. Errors are thrown as `new ApiError(statusCode, message)` and handled centrally by `middleware/errorHandler.js`.

**Cursor pagination** (`GET /chats/:id/messages?cursor=`): the cursor is the `_id` (or `createdAt`) of the last item from the previous page; the controller parses it, queries `{ _id: { $lt: cursor } }` sorted descending, and returns the next cursor alongside the page.

**Identity**: controllers read the authenticated user from `req.user` (attached by `auth.middleware.js`) — never from `req.body`.

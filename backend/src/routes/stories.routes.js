import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { postStory, listFeed, markViewed } from '../controllers/stories.controller.js';

const router = Router();

// No mimeType field required — same reasoning as messages: the client's claimed mime is never
// read, only the server-verified value from storage.headObject is used.
router.post(
  '/',
  authenticate,
  [body('objectKey').isString().notEmpty(), body('caption').optional().isString().trim()],
  validate,
  postStory
);

router.get('/feed', authenticate, listFeed);

router.post('/:id/view', authenticate, [param('id').isMongoId()], validate, markViewed);

export default router;

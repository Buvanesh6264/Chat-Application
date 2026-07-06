import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { getUploadUrl } from '../controllers/media.controller.js';

const router = Router();

router.post(
  '/upload-url',
  authenticate,
  [
    body('category').isIn(['photo', 'voice', 'pdf']),
    body('mimeType').isString().notEmpty(),
  ],
  validate,
  getUploadUrl
);

export default router;

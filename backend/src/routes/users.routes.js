import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { searchUsers, getProfile, updatePrivacy } from '../controllers/users.controller.js';

const router = Router();

const VISIBILITY_ENUM = ['Everyone', 'Friends', 'Nobody'];

router.get('/search', authenticate, [query('phone').isString().notEmpty()], validate, searchUsers);

router.get('/:id/profile', authenticate, [param('id').isMongoId()], validate, getProfile);

router.patch(
  '/me/privacy',
  authenticate,
  [
    body('profileVisibility').optional().isIn(VISIBILITY_ENUM),
    body('lastSeenVisibility').optional().isIn(VISIBILITY_ENUM),
    body('onlineStatusVisibility').optional().isIn(VISIBILITY_ENUM),
  ],
  validate,
  updatePrivacy
);

export default router;

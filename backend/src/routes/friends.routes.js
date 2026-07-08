import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  sendRequest,
  respondToRequest,
  blockUser,
  listPendingRequests,
  listFriends,
} from '../controllers/friends.controller.js';

const router = Router();

router.get('/', authenticate, listFriends);

router.get('/requests', authenticate, listPendingRequests);

router.post('/request', authenticate, [body('to').isMongoId()], validate, sendRequest);

router.post(
  '/respond',
  authenticate,
  [body('requestId').isMongoId(), body('action').isIn(['accept', 'reject'])],
  validate,
  respondToRequest
);

router.post('/block', authenticate, [body('userId').isMongoId()], validate, blockUser);

export default router;

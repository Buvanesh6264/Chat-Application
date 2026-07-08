import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  sendRequest,
  respondToRequest,
  blockUser,
  listPendingRequests,
  listSentRequests,
  cancelRequest,
  listFriends,
  removeFriend,
} from '../controllers/friends.controller.js';

const router = Router();

router.get('/', authenticate, listFriends);

router.get('/requests', authenticate, listPendingRequests);

router.get('/requests/sent', authenticate, listSentRequests);

router.post('/request', authenticate, [body('to').isMongoId()], validate, sendRequest);

router.post(
  '/respond',
  authenticate,
  [body('requestId').isMongoId(), body('action').isIn(['accept', 'reject'])],
  validate,
  respondToRequest
);

router.delete(
  '/requests/:requestId',
  authenticate,
  [param('requestId').isMongoId()],
  validate,
  cancelRequest
);

router.post('/block', authenticate, [body('userId').isMongoId()], validate, blockUser);

router.delete('/:friendId', authenticate, [param('friendId').isMongoId()], validate, removeFriend);

export default router;

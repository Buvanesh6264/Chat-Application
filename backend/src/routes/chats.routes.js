import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  listChats,
  createDirectChat,
  createGroupChat,
  addMember,
  removeMember,
  pinChat,
  unpinChat,
} from '../controllers/chats.controller.js';
import { listMessages } from '../controllers/messages.controller.js';

const router = Router();

router.get('/', authenticate, listChats);

router.post('/direct', authenticate, [body('userId').isMongoId()], validate, createDirectChat);

router.post(
  '/group',
  authenticate,
  [
    body('groupName').isString().trim().notEmpty(),
    body('participantIds').isArray({ min: 1 }),
    body('participantIds.*').isMongoId(),
  ],
  validate,
  createGroupChat
);

router.post(
  '/:id/members',
  authenticate,
  [param('id').isMongoId(), body('userId').isMongoId()],
  validate,
  addMember
);

router.delete(
  '/:id/members/:userId',
  authenticate,
  [param('id').isMongoId(), param('userId').isMongoId()],
  validate,
  removeMember
);

router.get(
  '/:id/messages',
  authenticate,
  [param('id').isMongoId()],
  validate,
  listMessages
);

router.patch('/:id/pin', authenticate, [param('id').isMongoId()], validate, pinChat);

router.delete('/:id/pin', authenticate, [param('id').isMongoId()], validate, unpinChat);

export default router;

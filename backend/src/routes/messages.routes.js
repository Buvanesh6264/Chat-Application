import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createMessage,
  editMessage,
  deleteMessage,
  TEXT_MESSAGE_TYPES,
  ALL_MESSAGE_TYPES,
} from '../controllers/messages.controller.js';

const router = Router();

const isTextType = (value, { req }) => TEXT_MESSAGE_TYPES.includes(req.body.type);
const isMediaType = (value, { req }) => !TEXT_MESSAGE_TYPES.includes(req.body.type);
const isVoiceType = (value, { req }) => req.body.type === 'voice';

router.post(
  '/',
  authenticate,
  [
    body('chatId').isMongoId(),
    body('type').isIn(ALL_MESSAGE_TYPES),
    // text/emoji: content is the message itself, required
    body('content').if(isTextType).isString().trim().notEmpty(),
    // photo/voice/pdf: content is an optional caption; objectKey identifies the upload. The
    // client's claimed mimeType/size are never trusted or read here — the server independently
    // re-verifies via storage.headObject(objectKey), so there's nothing for those fields to do.
    body('content').if(isMediaType).optional().isString().trim(),
    body('objectKey').if(isMediaType).isString().notEmpty(),
    body('durationSeconds').if(isVoiceType).isFloat({ min: 0 }),
  ],
  validate,
  createMessage
);

router.patch(
  '/:id',
  authenticate,
  [param('id').isMongoId(), body('content').isString().trim().notEmpty()],
  validate,
  editMessage
);

router.delete('/:id', authenticate, [param('id').isMongoId()], validate, deleteMessage);

export default router;

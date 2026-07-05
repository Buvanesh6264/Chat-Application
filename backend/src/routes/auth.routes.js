import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { signup, login, refresh, logout } from '../controllers/auth.controller.js';

const router = Router();

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const phoneValidator = body('phoneNumber')
  .trim()
  .matches(E164_REGEX)
  .withMessage('Phone number must be in E.164 format, e.g. +14155551234');

router.post(
  '/signup',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    phoneValidator,
    body('password').isString().isLength({ min: 8 }),
  ],
  validate,
  signup
);

router.post(
  '/login',
  authLimiter,
  [phoneValidator, body('password').isString().notEmpty()],
  validate,
  login
);

router.post('/refresh', refresh);

router.post('/logout', logout);

export default router;

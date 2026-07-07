import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createDownloadUrl } from '../services/storage.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '../utils/tokens.js';

const PASSWORD_MIN_LENGTH = 8;

// profileImageUrl is stored as a private-bucket objectKey (see users.controller.js#updateProfile)
// — resolve it to a short-lived signed GET URL here, same as serializeMessage does for message
// media, rather than handing back an unusable raw key.
const toPublicUser = async (user) => ({
  id: user._id,
  name: user.name,
  phoneNumber: user.phoneNumber,
  profileImageUrl: user.profileImageUrl ? await createDownloadUrl(user.profileImageUrl) : null,
  bio: user.bio,
  privacySettings: user.privacySettings,
  readReceiptsEnabled: user.readReceiptsEnabled,
  pinnedChats: user.pinnedChats,
});

const issueTokens = async (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return accessToken;
};

export const signup = asyncHandler(async (req, res) => {
  const { name, phoneNumber, password } = req.body;

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const existing = await User.findOne({ phoneNumber });
  if (existing) {
    throw new ApiError(409, 'Phone number already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, phoneNumber, passwordHash });

  const accessToken = await issueTokens(res, user);
  res.status(201).json({ user: await toPublicUser(user), accessToken });
});

export const login = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

  const user = await User.findOne({ phoneNumber }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  const accessToken = await issueTokens(res, user);
  res.json({ user: await toPublicUser(user), accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new ApiError(401, 'Refresh token missing');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    throw new ApiError(401, 'Refresh token has been revoked');
  }

  const accessToken = await issueTokens(res, user); // rotation: old hash is overwritten
  res.json({ accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await User.findByIdAndUpdate(payload.sub, { refreshTokenHash: null });
    } catch {
      // token already invalid/expired — nothing to revoke
    }
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).send();
});

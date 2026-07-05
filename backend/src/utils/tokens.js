import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), phoneNumber: user.phoneNumber }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

export const signRefreshToken = (user) =>
  // jti ensures two refresh tokens issued in the same second are never byte-identical, so
  // rotation always produces a genuinely new token to hash and compare against.
  jwt.sign({ sub: user._id.toString(), jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// Refresh tokens are stored hashed (not the raw JWT) so a DB leak doesn't hand out valid tokens.
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const REFRESH_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

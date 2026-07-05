import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

// The only place an access JWT is verified. Attaches req.user — controllers/sockets must derive
// identity from here, never from a client-supplied id in the body/payload.
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, phoneNumber: payload.phoneNumber };
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

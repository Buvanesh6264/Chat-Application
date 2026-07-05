import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};

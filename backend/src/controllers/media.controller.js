import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { createUploadUrl } from '../services/storage.js';
import { ALLOWED_MIME_TYPES } from '../utils/mediaTypes.js';

export const getUploadUrl = asyncHandler(async (req, res) => {
  const { category, mimeType } = req.body;

  const extensionsByMime = ALLOWED_MIME_TYPES[category];
  if (!extensionsByMime) {
    throw new ApiError(400, `Unsupported category. Expected one of: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`);
  }

  const extension = extensionsByMime[mimeType];
  if (!extension) {
    throw new ApiError(400, `Unsupported mimeType "${mimeType}" for category "${category}"`);
  }

  const { uploadUrl, objectKey } = await createUploadUrl({ userId: req.user.id, extension, mimeType });
  res.json({ uploadUrl, objectKey });
});

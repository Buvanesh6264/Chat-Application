import { ApiError } from '../utils/ApiError.js';
import { headObject } from './storage.js';
import { ALLOWED_MIME_TYPES, MAX_MEDIA_SIZE_BYTES } from '../utils/mediaTypes.js';

// Verifies an uploaded object actually belongs to the caller and actually matches what it claims
// to be — never trust the client's declared mimeType/size alone (supabase-upload-skill). Shared
// by services/messages.js (photo/voice/pdf attachments) and services/stories.js (photo stories).
export const validateMediaUpload = async (userId, category, objectKey) => {
  if (!objectKey || !objectKey.startsWith(`${userId}/`)) {
    throw new ApiError(403, 'Cannot attach media you did not upload');
  }

  let actual;
  try {
    actual = await headObject(objectKey);
  } catch {
    throw new ApiError(400, 'Uploaded object not found — upload it before attaching it here');
  }

  const allowedExtensionsByMime = ALLOWED_MIME_TYPES[category];
  if (!allowedExtensionsByMime[actual.mimeType]) {
    throw new ApiError(400, `Uploaded object's mime type "${actual.mimeType}" is not allowed for ${category}`);
  }
  if (actual.size > MAX_MEDIA_SIZE_BYTES[category]) {
    throw new ApiError(400, `Uploaded object exceeds the ${MAX_MEDIA_SIZE_BYTES[category]}-byte limit for ${category}`);
  }

  return actual;
};

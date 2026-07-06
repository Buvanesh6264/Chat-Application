// Shared between media.controller.js (upload-url issuance) and messages.controller.js
// (post-upload validation) so the two allowlists can never drift apart.
export const ALLOWED_MIME_TYPES = {
  photo: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  },
  voice: {
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
  },
  pdf: {
    'application/pdf': 'pdf',
  },
};

// Defaults — adjust if the product needs different limits.
export const MAX_MEDIA_SIZE_BYTES = {
  photo: 10 * 1024 * 1024,
  voice: 25 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
};

export const MEDIA_MESSAGE_TYPES = Object.keys(ALLOWED_MIME_TYPES);

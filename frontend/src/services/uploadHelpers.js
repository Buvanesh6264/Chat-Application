import { getUploadUrl } from './api.js';

// PUT's Content-Type must exactly match the mimeType requested from getUploadUrl, or the
// presigned signature is rejected (SignatureDoesNotMatch) — see .claude/skills/supabase-upload-skill.
export const uploadObject = async (category, blob) => {
  const { uploadUrl, objectKey } = await getUploadUrl(category, blob.type);
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type },
  });
  return objectKey;
};

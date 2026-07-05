---
name: supabase-upload-skill
description: Reusable signed-URL upload flow for media (photos, voice notes, PDFs) plus the client-side compression step, so the pattern isn't rebuilt per media type.
---

# Supabase upload pattern

End-to-end flow (backend never receives raw file bytes):

1. **Client requests a signed upload URL** from the backend, passing the intended mime type and a media category (`photo` | `voice` | `pdf`). Backend (`services/supabase.js`, media-integration's territory) validates the mime type against an allowlist for that category and returns a signed URL scoped to a specific object path (e.g. `chat-media/{userId}/{uuid}.{ext}`).
2. **Client compresses (images only)** via `services/imageCompression.js` (`browser-image-compression`) before uploading — never upload an uncompressed image.
3. **Client uploads directly to Supabase** using the signed URL — the Node backend is never in this data path.
4. **Client sends the resulting object path/URL** to the message-create (or story-create) endpoint, along with `mimeType`, `size`, and `durationSeconds` (voice only).
5. **Backend validates before persisting**: HEAD-check (or Supabase object-metadata read) the uploaded object's actual `Content-Type`/size against the same allowlist before writing the URL into a `Message`/`Story` document — reject if it doesn't match what step 1 authorized.

**Never** let the frontend hold the Supabase service-role key — it only ever has `VITE_SUPABASE_ANON_KEY`. The service-role key lives in `backend/.env` only and is used solely to issue signed URLs and to perform the step-5 validation read.

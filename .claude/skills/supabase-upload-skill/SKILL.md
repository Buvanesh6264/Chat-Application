---
name: supabase-upload-skill
description: Reusable presigned-URL upload flow for media (photos, voice notes, PDFs) via Supabase's S3-compatible Storage API, plus the client-side compression step, so the pattern isn't rebuilt per media type.
---

# Supabase S3-compatible upload pattern

End-to-end flow (backend never receives raw file bytes):

1. **Client requests a presigned upload URL** from the backend (`POST /api/media/upload-url`), passing the intended mime type and a media category (`photo` | `voice` | `pdf`). Backend (`services/storage.js`, media-integration's territory) validates the mime type against an allowlist for that category and returns a presigned `PUT` URL (via `@aws-sdk/s3-request-presigner` against `STORAGE_ENDPOINT`) scoped to a per-user object key: `{userId}/{uuid}.{ext}`.
2. **Client compresses (images only)** via `services/imageCompression.js` (`browser-image-compression`) before uploading — never upload an uncompressed image.
3. **Client uploads directly to storage** using the presigned URL — the Node backend is never in this data path. **The `Content-Type` header on this `PUT` must exactly match the `mimeType` sent in step 1** — it's baked into the signature (`PutObjectCommand`'s `ContentType`), so a mismatched or missing header fails with `SignatureDoesNotMatch` rather than silently uploading as `application/octet-stream`. A plain `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` satisfies this as long as `file.type` is the same mime type requested in step 1.
4. **Client sends the resulting object key** to the message-create (or story-create) endpoint, along with `mimeType`, `size`, and `durationSeconds` (voice only).
5. **Backend validates before persisting**: `headObject(objectKey)` (via `@aws-sdk/client-s3`'s `HeadObjectCommand`) to check the uploaded object's actual `Content-Type`/size against the same allowlist before writing the key/URL into a `Message`/`Story` document — reject if it doesn't match what step 1 authorized.

**Never** let the frontend hold `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` — those are backend-only secrets used solely to sign upload URLs and perform the step-5 validation read. The frontend never constructs storage URLs itself or talks to `STORAGE_ENDPOINT` directly except to `PUT` to a URL the backend already signed.

The S3 client uses `forcePathStyle: true` since the configured bucket name isn't a valid virtual-host label (mixed case, contains a space) — path-style addressing (`endpoint/bucket/key`) avoids that entirely.

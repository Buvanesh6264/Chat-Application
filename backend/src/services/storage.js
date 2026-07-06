import crypto from 'crypto';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 15 * 60;

const s3Client = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  region: process.env.STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
  // Path-style addressing (`endpoint/bucket/key`) rather than virtual-hosted-style
  // (`bucket.endpoint/key`) — required for a bucket name like "Chat Application" that isn't a
  // valid virtual-host label (mixed case, contains a space).
  forcePathStyle: true,
  // AWS SDK v3 defaults to always attaching a flexible-checksum param (x-amz-checksum-crc32) to
  // presigned URLs. That param becomes part of the signature, so any client that doesn't send a
  // byte-identical checksum (e.g. a plain curl/browser PUT) gets SignatureDoesNotMatch. Presigned
  // uploads here are consumed by arbitrary clients, not the SDK itself, so checksums must be
  // opt-in only.
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.STORAGE_BUCKET;

// Per-user folder: {userId}/{uuid}.{extension} — never lets one user's uploads collide with
// or be guessable from another's.
//
// ContentType is baked into the signed request so the client's PUT must send a matching
// Content-Type header (or the signature fails) — without this, the stored object's mime type
// is whatever the client happens to send, and headObject's post-upload allowlist check would
// depend on client behavior it can't actually enforce.
export const createUploadUrl = async ({ userId, extension, mimeType }) => {
  const objectKey = `${userId}/${crypto.randomUUID()}.${extension}`;

  const command = new PutObjectCommand({ Bucket: BUCKET, Key: objectKey, ContentType: mimeType });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: UPLOAD_URL_EXPIRES_SECONDS });

  return { uploadUrl, objectKey };
};

// Post-upload validation: confirms the object exists and reports its actual mime/size, so a
// caller can reject an upload that doesn't match what was authorized before referencing it
// elsewhere (e.g. in a future Message document).
export const headObject = async (objectKey) => {
  const result = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey }));
  return { mimeType: result.ContentType, size: result.ContentLength };
};

// The bucket is private, so a message's stored mediaUrl is really an objectKey — every read
// generates a fresh, short-lived presigned GET rather than a permanent public URL.
export const createDownloadUrl = async (objectKey) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: objectKey });
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS });
};

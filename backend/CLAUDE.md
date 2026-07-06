# Backend — Chat App

## Tech stack

Node.js 20 (`.nvmrc`), Express 5, MongoDB via Mongoose 9, Socket.io 4, Supabase Storage via its **S3-compatible API** (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, not the `@supabase/supabase-js` SDK), Groq API (speech-to-text + translation), JWT auth (access + refresh), in-memory presence (interface-swappable to Redis later — see `services/presence.js`).

## Folder structure

| Folder | Responsibility |
|---|---|
| `src/models/` | Mongoose schemas — owned exclusively by the `db-architect` agent |
| `src/routes/` | Path + middleware + controller wiring only, no business logic |
| `src/controllers/` | Thin orchestration: validate → call service/model → respond |
| `src/sockets/` | socket.io event handlers — owned by `socket-engineer` |
| `src/services/` | `storage.js` (S3-compatible presigned uploads), `groq.js`, `presence.js`, `privacy.js`, `translationCache.js` |
| `src/middleware/` | `auth.middleware.js`, `rateLimiter.js`, `validate.js`, `errorHandler.js` |
| `src/utils/` | `ApiError`, `asyncHandler`, `tokens.js` (JWT sign/verify helpers), `serializeMessage.js` (async — masks soft-deleted content, generates a fresh presigned download URL), `mediaTypes.js` (shared mime allowlist + size limits) |
| `src/config/` | `db.js` (Mongo connection, `dbName` defaults to `chat-app`), `env.js` (env var loading/validation) |
| `src/scripts/` | `migrate.js` (sync indexes against the real DB), `seed.js` (create a local dev test user) — run via `npm run migrate` / `npm run seed` |

## Data models — source of truth

```
User {
  _id, name, phoneNumber (E.164, unique, indexed), passwordHash,
  profileImageUrl, bio,
  privacySettings: { profileVisibility, lastSeenVisibility, onlineStatusVisibility }, // Everyone|Friends|Nobody
  readReceiptsEnabled: Boolean,
  lastSeenAt: Date, isOnline: Boolean,
  friends: [ObjectId ref User],
  blockedUsers: [ObjectId ref User],
  createdAt, updatedAt
}

FriendRequest {
  _id, from: ObjectId ref User, to: ObjectId ref User,
  status: 'pending' | 'accepted' | 'blocked',
  createdAt, updatedAt
}

Chat {
  _id, participants: [ObjectId ref User], isGroup: Boolean (default false),
  groupName: String,               // group chats only
  groupAvatarUrl: String,           // group chats only
  groupAdmins: [ObjectId ref User], // group chats only, subset of participants
  lastMessage: ObjectId ref Message,
  createdAt, updatedAt
}

Message {
  _id, chatId: ObjectId ref Chat, senderId: ObjectId ref User,
  type: 'text' | 'emoji' | 'photo' | 'voice' | 'pdf',
  content: String, mediaUrl: String,
  mediaMeta: { mimeType, size, durationSeconds },
  transcript: String, transcriptEdited: Boolean,    // voice notes; arrives async post-send
  translatedContent: [{ language, text }],           // populated on-demand per recipient, cached
  readBy: [{ userId, readAt }],                      // gated by mutual readReceiptsEnabled toggle
  reactions: [{ userId, emoji }],
  editedAt: Date, deletedAt: Date,
  createdAt
}

Story {
  _id, userId: ObjectId ref User, mediaUrl, caption,
  viewedBy: [ObjectId ref User],
  createdAt, expiresAt   // TTL index: { expires: 0 } on expiresAt — auto-deletes after 24h
}
```

Any schema change must update this section in the same PR. `db-architect` is the only agent that edits `src/models/`.

## REST API — implemented so far

```
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/search?phone=
GET    /users/:id/profile        (per-field privacy gated; 404 only on an actual block, never on a restrictive enum)
PATCH  /users/me/privacy

POST   /friends/request           { to }
POST   /friends/respond           { requestId, action: 'accept'|'reject' }
POST   /friends/block             { userId }
GET    /friends/requests          -- addition beyond the spec's high-level list: lists pending incoming requests

GET    /chats                     -- lists the caller's chats, sorted by updatedAt desc, participants + lastMessage populated
POST   /chats/direct              { userId } -- addition: find-or-create a 1:1 chat; spec's REST list never specified how a chat is created
POST   /chats/group               { groupName, participantIds }
POST   /chats/:id/members         { userId } -- group only, admin-only
DELETE /chats/:id/members/:userId -- group only, admin-only to remove others, self-removal (leave) always allowed
GET    /chats/:id/messages?cursor=&limit=  -- cursor is the previous page's last message _id, descending

POST   /messages                  { chatId, type: 'text'|'emoji', content }
                                   { chatId, type: 'photo'|'voice'|'pdf', objectKey, content? (caption), durationSeconds? (voice) }
                                   -- media messages: server re-verifies the object's real mime/size via storage.headObject
                                   -- before persisting; client-claimed mimeType/size in the request are never trusted/read
PATCH  /messages/:id              { content } -- sender-only, within the 15-minute edit/delete window
DELETE /messages/:id              -- sender-only, within the same window, soft-delete (deletedAt set; content/mediaUrl null out in reads)

POST   /media/upload-url          { category: 'photo'|'voice'|'pdf', mimeType } -- returns a presigned S3-compatible PUT URL scoped to {userId}/...
```

`Message.mediaUrl` stores the **objectKey**, not a URL — the bucket is private, so every read (`GET /chats/:id/messages`, `GET /chats` via `lastMessage`) generates a fresh, short-lived presigned `GET` URL through `serializeMessage`/`storage.createDownloadUrl` rather than persisting a permanent link.

Voice-note `transcript`/`transcriptEdited` round-trip at their schema defaults (`null`/`false`) — actually calling Groq STT is step 9 (`ai-integration`'s territory), not yet built.

Not yet built: `POST /stories`, `GET /stories/feed`, `POST /ai/transcribe`, `POST /ai/translate` (stub route files exist).

## Conventions

- **Route → controller → service split**: routes only wire path+middleware+controller; controllers only orchestrate (validation result handling, calling a service/model, shaping the response); business/data logic lives in `services/` or model statics.
- Every route handler is wrapped in `asyncHandler` — no manual try/catch per controller. Errors are thrown as `new ApiError(statusCode, message)` and handled centrally by `middleware/errorHandler.js`.
- `middleware/auth.middleware.js` is the **only** place a JWT is verified; it attaches `req.user = { id, phoneNumber }`. **Never trust `req.body.senderId` or any client-supplied user ID** — identity always comes from `req.user` (REST) or `socket.data.userId` (sockets, set once during the auth handshake).
- All profile/story/presence/last-seen reads **must** go through `services/privacy.js` — do not duplicate the Everyone/Friends/Nobody check per route. See `.claude/skills/privacy-check-skill/SKILL.md`.
  - **Two deliberate exceptions, not oversights**: `chats.controller.js#listChats` returns participant name/phone/photo unfiltered by `profileVisibility` — you're already in a chat with them, gating their identity in your own chat list would break the UI. `users.controller.js#searchUsers` also returns name/phone/photo unfiltered by `profileVisibility` (only block-filtered) — phone-number search is intentionally Telegram-style ("if you know the number, you can find the person"); `profileVisibility` governs the deeper `GET /users/:id/profile` read, not discoverability. If this app's product direction changes to hide identity from search/chat-lists too, both call sites need updating together.
- Presence is accessed only via `services/presence.js`'s exported functions (`setOnline`, `setOffline`, `isOnline`, `getLastSeen`) — never touch the in-memory Map directly, so swapping to Redis later only touches one file.
- See `.claude/skills/` for the standard schema, route, socket-event, upload, Groq-call, and privacy-check patterns — don't re-derive them per file.

## Env vars

| Var | Used by |
|---|---|
| `NODE_ENV`, `PORT`, `CLIENT_URL` | `server.js`, `app.js` (CORS) |
| `MONGO_URI` | `config/db.js` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | `auth.middleware.js`, `auth.controller.js`, `sockets/index.js` |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION` | `services/storage.js` — Supabase's S3-compatible Storage API; these are backend-only, never exposed to the frontend |
| `GROQ_API_KEY`, `GROQ_STT_MODEL`, `GROQ_TRANSLATE_MODEL` | `services/groq.js` |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_ATTEMPTS` | `middleware/rateLimiter.js` |

Copy `.env.example` to `.env` and fill in real values before running.

## Commands

```bash
npm run dev      # nodemon src/server.js
npm test         # vitest run — uses mongodb-memory-server, no real Mongo needed
npm run lint     # eslint .
npm run migrate  # sync Mongoose indexes against the real MONGO_URI
npm run seed     # create/verify a local dev test user against the real MONGO_URI
```

## Security checklist (see also spec section 9 / `code-reviewer` agent)

- Never trust client-supplied identity on REST or socket calls.
- Rate-limit `/auth/*` and `/ai/*`.
- Validate uploaded media mime type/size server-side (HEAD-check against the Supabase object) before persisting a URL into a message.
- Do not duplicate privacy-check logic — always use `services/privacy.js` (`isBlockedPair`/`canViewField`/`canView`).
- Blocked users cannot message each other — `messages.controller.js` re-checks `isBlockedPair` on every send to a direct chat, not just at chat-creation time, since a block can happen after a chat already exists.
- Message edit/delete is sender-only and time-boxed (`EDIT_DELETE_WINDOW_MS`, 15 min) — enforced server-side in `messages.controller.js`, never trust a client-side timer.

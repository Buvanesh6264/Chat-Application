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
| `src/services/` | `storage.js` (S3-compatible presigned uploads), `groq.js` (`transcribeAudio`/`translateText`, retry/backoff on 429/5xx only), `presence.js` (in-memory online tracking + DB write-through), `privacy.js`, `translationCache.js` (DB-backed, `Message.translatedContent` *is* the cache), `transcription.js` (`transcribeVoiceMessage` orchestration), `realtime.js` (`initRealtime`/`emitToUser` — lets services push socket events without an `io` reference), `chats.js` (`getParticipantChat` — shared REST/socket authorization), `messages.js` (`sendMessage`/`editMessageContent`/`editTranscript`/`softDeleteMessage`), `mediaValidation.js` (`validateMediaUpload` — ownership + `headObject` mime/size check, shared by `messages.js` and `stories.js`), `stories.js` (`createStory`/`getFeed`/`viewStory`) |
| `src/middleware/` | `auth.middleware.js`, `rateLimiter.js`, `validate.js`, `errorHandler.js` |
| `src/utils/` | `ApiError`, `asyncHandler`, `tokens.js` (JWT sign/verify helpers), `serializeMessage.js` (async — masks soft-deleted content, generates a fresh presigned download URL), `serializeStory.js` (async, viewer-aware — `viewedBy` only for the story's own owner), `mediaTypes.js` (shared mime allowlist + size limits) |
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
  pinnedChats: [ObjectId ref Chat],
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
  groupAdmins: [ObjectId ref User], // group chats only, subset of participants; groupAdmins[0] is
                                    // treated as "the leader" everywhere group rules mention one
                                    // (creation/add-member validation) — no separate leaderId field
  lastMessage: ObjectId ref Message,
  unreadCounts: [{ userId: ObjectId ref User, count: Number }], // per-participant unread counter
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
GET    /users/:id/profile        (per-field privacy gated; 404 only on an actual block, never on a restrictive enum;
                                   response also includes `relationship`: 'self'|'friends'|'request_sent'|
                                   'request_received'|'none', computed independently of the privacy-gated fields
                                   above so a non-friend contact with a hidden profile still gets a working
                                   friend-request button)
PATCH  /users/me/privacy          { profileVisibility?, lastSeenVisibility?, onlineStatusVisibility?, readReceiptsEnabled? }
PATCH  /users/me/profile          { name?, bio?, profileImageUrl? } -- self-profile edit; profileImageUrl is an
                                   objectKey already uploaded via POST /media/upload-url (category 'photo'), not a
                                   file itself; re-verified via services/mediaValidation.js#validateMediaUpload
                                   before persisting, same as message/story media. Response's profileImageUrl (and
                                   every other profileImageUrl this API returns — GET /users/:id/profile, login/
                                   signup's toPublicUser) is a freshly resolved presigned GET URL, not the raw
                                   objectKey — the bucket is private, so the stored value alone isn't fetchable.

GET    /friends                   -- lists the caller's accepted friends (name, phone, photo, privacy-gated
                                   isOnline/lastSeenAt per canViewField, same rules as GET /users/:id/profile)
POST   /friends/request           { to }
POST   /friends/respond           { requestId, action: 'accept'|'reject' }
POST   /friends/block             { userId }
GET    /friends/requests          -- addition beyond the spec's high-level list: lists pending incoming requests
GET    /friends/requests/sent     -- lists the caller's own pending outgoing requests (populated with recipient)
DELETE /friends/requests/:requestId -- cancel an outgoing pending request; sender-only, 404 otherwise, deletes the doc
DELETE /friends/:friendId         -- unfriend; two-sided $pull of friends[] plus cleanup of the 'accepted'
                                   FriendRequest doc between the pair (without it, sendRequest's dedup check
                                   would permanently block them from re-friending later)

GET    /chats                     -- lists the caller's chats, sorted by updatedAt desc, participants + lastMessage populated
POST   /chats/direct              { userId } -- addition: find-or-create a 1:1 chat; spec's REST list never specified how a chat is created
POST   /chats/group               { groupName, participantIds } -- every participantIds entry must be in the
                                   caller's friends[] (services/privacy.js#isFriend), 403 otherwise; creator
                                   becomes groupAdmins[0], treated as "the leader" everywhere one is needed
POST   /chats/:id/members         { userId } -- group only, leader-or-admin (any entry in groupAdmins), and
                                   the target must be a friend of the *acting* admin specifically (not the
                                   leader's or any other participant's friend) — 403 on either failure,
                                   enforced here even if the UI never exposes the control to a non-admin
DELETE /chats/:id/members/:userId -- group only, admin-only to remove others, self-removal (leave) always allowed
PATCH  /chats/group/:id           { groupName?, groupAvatarUrl? } -- group only, leader-or-admin (any entry in
                                   groupAdmins). groupAvatarUrl is a client-uploaded objectKey re-verified via
                                   validateMediaUpload('photo', ...) before persisting, same discipline as
                                   profile photos; response resolves it to a presigned GET URL, never the raw key
POST   /chats/group/:id/admins/:userId   -- promote a participant to admin; leader-only (groupAdmins[0]);
                                   $addToSet (append-only) so groupAdmins[0] never changes
DELETE /chats/group/:id/admins/:userId   -- demote an admin; leader-only; rejects demoting groupAdmins[0] itself
                                   (403) -- the one hard rule that must not regress
GET    /chats/:id/messages?cursor=&limit=  -- cursor is the previous page's last message _id, descending
PATCH  /chats/:id/pin             -- pin a chat for the caller only (User.pinnedChats), 404 if caller isn't a participant
DELETE /chats/:id/pin             -- unpin; 404 if caller isn't a participant (same guard as pin), no-op
                                   (not an error) if it wasn't pinned

POST   /messages                  { chatId, type: 'text'|'emoji', content }
                                   { chatId, type: 'photo'|'voice'|'pdf', objectKey, content? (caption), durationSeconds? (voice) }
                                   -- media messages: server re-verifies the object's real mime/size via storage.headObject
                                   -- before persisting; client-claimed mimeType/size in the request are never trusted/read
PATCH  /messages/:id              { content } -- sender-only, within the 15-minute edit/delete window
PATCH  /messages/:id/transcript   { transcript } -- sender-only, voice messages only, NO time window (ASR correction is a
                                   different concept from editing what you said, and Groq can be slower than 15 min under
                                   load); sets transcriptEdited: true; broadcasts message:edit (no dedicated socket event)
DELETE /messages/:id              -- sender-only, within the same window, soft-delete (deletedAt set; content/mediaUrl null out in reads)

POST   /media/upload-url          { category: 'photo'|'voice'|'pdf', mimeType } -- returns a presigned S3-compatible PUT URL scoped to {userId}/...

POST   /ai/transcribe             { messageId } -- sender-only, voice only; automatic transcription already fires on every
                                   voice send (services/messages.js#sendMessage, fire-and-forget) — this is a manual
                                   re-run for when that silently failed or Groq hiccuped
POST   /ai/translate              { messageId, targetLanguage } -- any chat participant; recipient-requested-on-read
                                   (deliberate deviation from the spec's literal "sender picks before sending" — see
                                   .claude/agents/ai-integration.md), checks services/translationCache.js before calling
                                   Groq, persists + returns { language, text, cached }. Translates message.content —
                                   for a voice message that's the (usually empty) caption, not the transcript; translating
                                   the transcript itself isn't built in this pass.
```

`Message.mediaUrl` stores the **objectKey**, not a URL — the bucket is private, so every read (`GET /chats/:id/messages`, `GET /chats` via `lastMessage`) generates a fresh, short-lived presigned `GET` URL through `serializeMessage`/`storage.createDownloadUrl` rather than persisting a permanent link.

`translatedContent` is invalidated (`$set: []`) whenever a message's `content` is edited (`services/messages.js#editMessageContent`) — a cached translation of the old text would otherwise silently persist and be served for the new text.

**Voice transcription's Supabase leg is still blocked by the unresolved storage credential issue** (`SignatureDoesNotMatch`, confirmed still failing as of this pass — pre-existing, not introduced here). `transcribeVoiceMessage` fetches the audio via a presigned `GET` URL through the same broken S3 client `storage.js` uses; until that's fixed, real voice messages will fail transcription (the manual `POST /ai/transcribe` retry will 502, and the automatic fire-and-forget attempt fails silently, logged only). The Groq integration itself is verified independently: `translateText` was live-tested against the real Groq API (including a real cache-hit vs. cache-miss latency difference) — `transcribeAudio` uses the identical client/auth pattern, so this is specifically a storage-credential blocker, not a Groq integration risk.

```
POST   /stories                   { objectKey, caption? } -- photo only (spec never mentions video, and Story has no
                                   type/mediaMeta field to store it against — reuses the existing 'photo' category,
                                   no media-allowlist changes); expiresAt computed server-side as now + 24h; fires story:new
GET    /stories/feed               -- caller's own + friends' currently-active stories (expiresAt > now, defensive filter —
                                   don't rely solely on Mongo's TTL sweep timing); friends[] already excludes blocked
                                   pairs by construction, no separate block check needed
POST   /stories/:id/view           -- addition beyond the spec's 2-endpoint list: without it, viewedBy would never get
                                   populated. Non-friend attempts 404 (existence not leaked); viewing your own story
                                   is a no-op, doesn't add you to your own viewedBy
```

`Story.viewedBy` is only ever exposed to the story's own owner (`serializeStory(story, viewerId)` is viewer-aware, unlike `serializeMessage`) — a friend viewing someone else's story sees `viewedByMe: boolean` but `viewedBy: undefined`. The `story:new` socket push uses a separate, viewer-neutral payload (not `serializeStory(story, posterId)`, which is owner-perspective and would otherwise leak an empty `viewedBy: []` to every recipient) — a brand-new story has no per-viewer state yet, so the broadcast reflects that directly instead of reusing the REST response's owner-scoped shape.

**Story media upload is blocked by the same unresolved Supabase storage credential issue as voice notes** (see the transcription note above) — the presigned upload path is identical (`mediaValidation.js#validateMediaUpload` → `storage.headObject`/`createDownloadUrl`), so real story creation will fail until that's fixed. The feed/view/privacy logic was verified directly against the real Atlas DB (bypassing the upload step) independent of the storage blocker.

## Socket.io events — implemented so far

Auth: JWT passed as `socket.handshake.auth.token`, verified once at handshake (`sockets/index.js`), sets `socket.data.userId`. Every socket then joins its own `user:${userId}` room — **rooms are per-user, not per-chat** (a deliberate deviation from the naive `roomFor(chatId)` pattern: pre-joining chat rooms breaks the moment a new chat is created, since the other participant's already-connected socket wouldn't be in that room yet). Sending/broadcasting always targets `user:${id}` rooms for a chat's current participants — still room-scoped, never a global `io.emit()`.

```
message:send      { chatId, type, content?, objectKey?, durationSeconds? } + ack -> message:receive to all participants (incl. sender's other tabs)
message:edit      { messageId, content } + ack -> message:edit to all participants
message:delete    { messageId } + ack -> message:delete (masked/soft-deleted) to all participants
message:reaction  { messageId, emoji } + ack -> message:reaction; toggle semantics (same emoji again removes it)
message:read      { chatId, upToMessageId } + ack -> message:read to other participants

typing:start / typing:stop   { chatId } -> relayed to other participants only, never echoed to the sender; ephemeral, not persisted

presence:update   { userId, isOnline, lastSeenAt } -> pushed only to the user's friends on a genuine
                  online/offline transition (not every extra tab); onlineStatusVisibility and
                  lastSeenVisibility are checked and nulled independently per field, same principle
                  as the REST profile fix. Non-friend viewers still get correct current data via the
                  existing GET /users/:id/profile REST read — there's no proactive push to strangers
                  even under an 'Everyone' visibility setting (this doesn't scale as a broadcast and
                  isn't how Telegram/WhatsApp behave either).

message:transcript-ready   (serialized message) -> pushed to all of a voice message's participants once
                  Groq's transcription resolves. Not in the spec's own event list (§7) — the only name
                  proposed anywhere is .claude/skills/groq-call-skill/SKILL.md's suggestion, adopted as-is.
                  Emitted via services/realtime.js (a service-level bus set up once at socket-server init),
                  not from within sockets/message.handlers.js — the trigger lives in
                  services/messages.js#sendMessage so both REST and socket sends get it for free.

story:new         (viewer-neutral story payload) -> pushed to the poster's friends and the poster's own other
                  devices (same user:${id} room pattern as message:receive's "notify the sender's other tabs")
                  on every story creation. No per-field privacy branching needed (unlike presence) — friends[]
                  already is the exact visibility set for stories. Emitted from services/stories.js via the
                  same realtime.js bus, not from a dedicated socket handler file.

friend:request:new   ({ request } with `from` populated name/phoneNumber/profileImageUrl) -> pushed to the
                  recipient the moment POST /friends/request creates the doc, via services/realtime.js#emitToUser
                  (friends.controller.js#sendRequest is a REST-only controller, not a socket handler — this is
                  the one place realtime.js is called directly from a controller rather than a service). Payload
                  shape matches GET /friends/requests exactly so a live push and a subsequent refetch render
                  identically.

chat:unreadUpdate    ({ chatId, count }) -> pushed to a single user (never broadcast to all participants)
                  on two occasions: (1) services/messages.js#sendMessage increments Chat.unreadCounts for
                  every recipient-but-the-sender on every send (REST and socket alike, since both paths call
                  this one function) and pushes each recipient their own new count; (2) message.handlers.js's
                  message:read resets the caller's own counter to 0 and pushes `{ count: 0 }` back to
                  themselves (for their other open tabs/devices) — this reset runs before the
                  readReceiptsEnabled early-return, since clearing your own badge is unrelated to whether you
                  broadcast read receipts to others.
```

**Known gap, decided consciously, not fixed**: the mutual `readReceiptsEnabled` suppression rule ("if a user disables it, they also stop seeing others' receipts") is enforced on the `message:read` socket broadcast, but **not** on `GET /chats/:id/messages` — `serializeMessage` returns `readBy` verbatim regardless of the requesting viewer's own toggle, because it has no notion of "who's asking." A receipts-disabled user can still see others' read status by polling REST. The spec explicitly scopes this enforcement to "the socket handler, not the frontend," which covers the real-time path; closing the REST gap would mean threading viewer identity into `serializeMessage` everywhere it's called (`messages.controller.js`, `chats.controller.js`) — a larger change than this pass warrants. Worth fixing if/when the REST message-list becomes the primary read path (e.g. an offline-first frontend that polls instead of relying on live socket events).

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
- Rate-limit `/auth/*` and `/ai/*`. `/ai/transcribe` and `/ai/translate` use **separate** `createRateLimiter` instances, not one shared counter — translation is recipient-requested-on-read, so a user reading several messages in a foreign-language chat needs a much higher budget (`limit: 60`) than the tighter default used for the manual transcribe-retry endpoint. A cache hit on `/ai/translate` still consumes budget (the limiter runs before the controller knows it's a hit) — accounted for in the generous limit, not otherwise mitigated.
- Validate uploaded media mime type/size server-side (HEAD-check against the Supabase object) before persisting a URL into a message.
- Do not duplicate privacy-check logic — always use `services/privacy.js` (`isBlockedPair`/`canViewField`/`canView`).
- Blocked users cannot message each other — `services/messages.js#sendMessage` re-checks `isBlockedPair` on every send to a direct chat (REST and socket alike, since both call this one function), not just at chat-creation time, since a block can happen after a chat already exists.
- Message edit/delete is sender-only and time-boxed (`EDIT_DELETE_WINDOW_MS`, 15 min) — enforced server-side in `services/messages.js`, never trust a client-side timer. REST controllers and socket handlers both delegate to this one implementation — never duplicate it.

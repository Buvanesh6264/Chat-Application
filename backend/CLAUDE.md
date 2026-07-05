# Backend — Chat App

## Tech stack

Node.js 20 (`.nvmrc`), Express 5, MongoDB via Mongoose 9, Socket.io 4, Supabase Storage (media), Groq API (speech-to-text + translation), JWT auth (access + refresh), in-memory presence (interface-swappable to Redis later — see `services/presence.js`).

## Folder structure

| Folder | Responsibility |
|---|---|
| `src/models/` | Mongoose schemas — owned exclusively by the `db-architect` agent |
| `src/routes/` | Path + middleware + controller wiring only, no business logic |
| `src/controllers/` | Thin orchestration: validate → call service/model → respond |
| `src/sockets/` | socket.io event handlers — owned by `socket-engineer` |
| `src/services/` | `supabase.js`, `groq.js`, `presence.js`, `privacy.js`, `translationCache.js` |
| `src/middleware/` | `auth.middleware.js`, `rateLimiter.js`, `validate.js`, `errorHandler.js` |
| `src/utils/` | `ApiError`, `asyncHandler` |
| `src/config/` | `db.js` (Mongo connection), `env.js` (env var loading/validation) |

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

## Conventions

- **Route → controller → service split**: routes only wire path+middleware+controller; controllers only orchestrate (validation result handling, calling a service/model, shaping the response); business/data logic lives in `services/` or model statics.
- Every route handler is wrapped in `asyncHandler` — no manual try/catch per controller. Errors are thrown as `new ApiError(statusCode, message)` and handled centrally by `middleware/errorHandler.js`.
- `middleware/auth.middleware.js` is the **only** place a JWT is verified; it attaches `req.user = { id, phoneNumber }`. **Never trust `req.body.senderId` or any client-supplied user ID** — identity always comes from `req.user` (REST) or `socket.data.userId` (sockets, set once during the auth handshake).
- All profile/story/presence/last-seen reads **must** go through `services/privacy.js` — do not duplicate the Everyone/Friends/Nobody check per route. See `.claude/skills/privacy-check-skill/SKILL.md`.
- Presence is accessed only via `services/presence.js`'s exported functions (`setOnline`, `setOffline`, `isOnline`, `getLastSeen`) — never touch the in-memory Map directly, so swapping to Redis later only touches one file.
- See `.claude/skills/` for the standard schema, route, socket-event, upload, Groq-call, and privacy-check patterns — don't re-derive them per file.

## Env vars

| Var | Used by |
|---|---|
| `NODE_ENV`, `PORT`, `CLIENT_URL` | `server.js`, `app.js` (CORS) |
| `MONGO_URI` | `config/db.js` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | `auth.middleware.js`, `auth.controller.js`, `sockets/index.js` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | `services/supabase.js` — service-role key only, never exposed to frontend |
| `GROQ_API_KEY`, `GROQ_STT_MODEL`, `GROQ_TRANSLATE_MODEL` | `services/groq.js` |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_ATTEMPTS` | `middleware/rateLimiter.js` |

Copy `.env.example` to `.env` and fill in real values before running.

## Commands

```bash
npm run dev    # nodemon src/server.js
npm test       # vitest run — uses mongodb-memory-server, no real Mongo needed
npm run lint   # eslint .
```

## Security checklist (see also spec section 9 / `code-reviewer` agent)

- Never trust client-supplied identity on REST or socket calls.
- Rate-limit `/auth/*` and `/ai/*`.
- Validate uploaded media mime type/size server-side (HEAD-check against the Supabase object) before persisting a URL into a message.
- Do not duplicate privacy-check logic — always use `services/privacy.js`.

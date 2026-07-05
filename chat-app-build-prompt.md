# Master Build Prompt — Telegram-Style Chat App

> Paste this whole document to Claude Code as the project kickoff prompt. It is written so Claude Code can generate the repo, CLAUDE.md files, agents, and skills before writing any feature code.

## 0. Instructions to Claude Code (read first)

You are setting up a full-stack real-time chat application. Before writing any feature code:

1. Create the repo structure in section 3.
2. Generate `backend/CLAUDE.md` and `frontend/CLAUDE.md` per section 10.1.
3. Generate the subagents in `.claude/agents/` per section 10.2.
4. Generate the skills in `.claude/skills/` per section 10.3.
5. Only then start implementing features, following the build order in section 11.
6. Confirm the data models (section 5) and API contract (section 6/7) with me before generating CRUD code, since both frontend and backend depend on them matching exactly.

---

## 1. Project Overview

A Telegram-style real-time messaging app supporting text, photos, voice messages, PDFs, and emoji, with phone-number-based auth, friend-gated profiles, stories, AI-powered voice transcription, and AI-powered translation.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite), Socket.io-client |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB (Mongoose) |
| Media storage | Supabase Storage (images, voice notes, PDFs) |
| AI | Groq API — speech-to-text + text translation |
| Auth | Phone number + password, JWT (access + refresh) |
| Presence store | Redis (or in-memory map for MVP — flagged optional below) |

## 3. Repo Structure

```
chat-app/
├── backend/
│   ├── CLAUDE.md
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── sockets/         # socket.io event handlers
│   │   ├── services/        # supabase.js, groq.js, redis.js
│   │   ├── middleware/      # auth, rateLimiter, validation
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── CLAUDE.md
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── services/        # api.js, socket.js
│   │   └── App.jsx
│   └── package.json
├── .claude/
│   ├── agents/
│   └── skills/
└── README.md
```

## 4. Core Feature Spec

### 4.1 Auth
- Signup: phone number (unique) + password. No OTP/SMS verification (skipped — requires a paid SMS provider). Enforce uniqueness at the DB layer (`unique: true` index on phone number) since there's no OTP step to prevent duplicate/spoofed numbers.
- Login: phone number + password → JWT **access token** (short-lived, e.g. 15 min) + **refresh token** (long-lived, e.g. 7 days, stored hashed in DB so it can be revoked).
- `POST /auth/refresh` rotates the refresh token (issue a new one, invalidate the old) and returns a new access token.
- Rate limit login/signup endpoints using `express-rate-limit` (free, in-memory, no external service/cost) — e.g. 5 attempts / 15 min per IP+phone, to blunt brute-force attempts even without OTP.

### 4.2 Profile & Privacy
- Profile fields: name, profile image, phone number, bio, status.
- Single `privacySettings` object per user with three independent enums, each `Everyone | Friends | Nobody`:
  - `profileVisibility` (name/image/phone)
  - `lastSeenVisibility`
  - `onlineStatusVisibility`
- Story posting: story is visible only to users in `friends[]` regardless of other settings.
- Friend system: `FriendRequest` model with status `pending | accepted | blocked`. Profile fields, story, last-seen, and online status are only revealed to users with an `accepted` relationship (subject to the enum above).
- [Optional] Block user: blocked users cannot message, see profile, or find the blocker via search.

### 4.3 Search
- Search users by exact/partial phone number.
- Phone number field: `unique: true, index: true` in MongoDB — enforce uniqueness at the DB layer, not just app logic.

### 4.4 Messaging
- Message types: text, emoji, photo, voice note, PDF.
- Media (photo, voice, PDF) uploaded client-side to Supabase Storage; message stores the returned URL + metadata (mime type, size, duration for voice).
- Edit/delete message within a time window (e.g. 15 min) — `editedAt`/`deletedAt` fields, enforced server-side by comparing `createdAt`.
- Typing indicators (`typing:start` / `typing:stop`) over the existing socket connection.
- Message reactions (emoji reaction per user per message) — small `reactions: [{ userId, emoji }]` array on the Message model.

### 4.5 Voice-to-Text
- On sending a voice note, backend calls Groq's speech-to-text to produce a transcript.
- Transcript is stored alongside the audio and is **editable** by the sender before/after sending (store `transcript` and `transcriptEdited: boolean` separately from the original Groq output so the raw transcription is never lost).

### 4.6 Translation
- User can select a target language before sending a text message; backend calls Groq to translate, and the recipient sees the translated version (original also stored).
- [Optional] Cache `(messageId, targetLanguage) → translatedText` so repeat requests don't re-hit the API.

### 4.7 Presence & Read Receipts
- Online status: shown per the privacy enum in 4.2.
- Last-seen: shown per the privacy enum in 4.2, updated on socket disconnect.
- Read receipts: per-user toggle `readReceiptsEnabled: boolean`. If a user disables it, they also stop seeing others' read receipts (mutual, like WhatsApp) — enforce this rule in the socket handler, not just the UI.

### 4.8 Stories
- [Optional] TTL index on story documents so they auto-expire after 24h.

---

## 5. Data Models (MongoDB / Mongoose)

```
User {
  _id, name, phoneNumber (unique, indexed), passwordHash,
  profileImageUrl, bio,
  privacySettings: { profileVisibility, lastSeenVisibility, onlineStatusVisibility },
  readReceiptsEnabled: Boolean,
  lastSeenAt: Date,
  isOnline: Boolean,
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
  _id, participants: [ObjectId ref User], isGroup: Boolean,
  lastMessage: ObjectId ref Message, createdAt, updatedAt
}

Message {
  _id, chatId: ObjectId ref Chat, senderId: ObjectId ref User,
  type: 'text' | 'emoji' | 'photo' | 'voice' | 'pdf',
  content: String,                // text/emoji content, or caption
  mediaUrl: String,
  mediaMeta: { mimeType, size, durationSeconds },
  transcript: String,             // for voice notes
  transcriptEdited: Boolean,
  translatedContent: [{ language, text }],
  readBy: [{ userId, readAt }],
  reactions: [{ userId, emoji }],
  editedAt: Date,
  deletedAt: Date,
  createdAt
}

Story {
  _id, userId: ObjectId ref User, mediaUrl, caption,
  viewedBy: [ObjectId ref User],
  createdAt, expiresAt   // TTL index on expiresAt
}
```

## 6. REST API (high level)

```
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout             (revokes refresh token)
GET    /users/search?phone=
GET    /users/:id/profile      (enforces friend + privacy check)
PATCH  /users/me/privacy
POST   /friends/request
POST   /friends/respond
POST   /friends/block
GET    /chats
GET    /chats/:id/messages?cursor=
POST   /messages                (with media upload handled via Supabase first)
PATCH  /messages/:id            (edit)
DELETE /messages/:id
POST   /stories
GET    /stories/feed
POST   /ai/transcribe            (Groq STT)
POST   /ai/translate             (Groq translation)
```

## 7. Socket.io Events

```
connection / disconnect        → presence updates
message:send / message:receive
message:edit / message:delete
message:read
message:reaction
typing:start / typing:stop
presence:update
story:new
```

## 8. Third-Party Integration Notes

- **Supabase**: use signed upload URLs from backend; frontend uploads directly to Supabase, then sends the resulting URL to the backend when creating the message — keeps large files off your Node server.
- **Groq**: wrap all calls in a single `services/groq.js` with two functions, `transcribeAudio(audioUrl)` and `translateText(text, targetLang)`. Add basic retry/backoff and (optional) a translation cache.

## 9. Security & Privacy Rules

- Never trust client-supplied `senderId` on socket events — derive from the authenticated session.
- All profile/story/presence reads must go through a single privacy-check helper function (don't duplicate the check per route).
- Rate-limit `/auth/*` and `/ai/*` (Groq calls cost money and can be abused).
- Validate uploaded file mime types server-side before accepting the Supabase URL into a message.

---

## 10. Claude Code Configuration

### 10.1 CLAUDE.md files (separate, backend and frontend)

**`backend/CLAUDE.md`** should document:
- Tech stack and folder structure for this half of the repo only.
- The data models (copy section 5) as the source of truth.
- Conventions: controller/service/route split, error-handling middleware pattern, how auth middleware attaches `req.user`.
- Env vars required (`MONGO_URI`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`, `REDIS_URL` if used).
- Command to run dev server, run tests, run lint.
- Explicit note: "Do not duplicate privacy-check logic — always use `services/privacy.js`."

**`frontend/CLAUDE.md`** should document:
- Tech stack, routing structure, state management approach (React Context or a store, pick one and document it).
- API base URL / socket URL env vars.
- Component conventions (naming, folder-per-feature vs folder-per-type — pick one).
- How auth token is stored/refreshed and attached to requests/socket connection.
- Design conventions (spacing, color tokens, icon set) so generated UI stays consistent.

### 10.2 Agents (`.claude/agents/`)

| Agent | Responsibility |
|---|---|
| `db-architect` | Owns Mongoose schemas, indexes, migrations. Only agent that edits `models/`. |
| `api-builder` | Builds Express routes/controllers against the agreed API contract. |
| `socket-engineer` | Owns all `sockets/` event handlers and presence/read-receipt logic. |
| `auth-security` | Owns auth flow, JWT access/refresh tokens, rate limiting. |
| `media-integration` | Owns Supabase upload/signed-URL logic. |
| `ai-integration` | Owns `services/groq.js` (transcription + translation), including caching/retry. |
| `frontend-architect` | Owns component structure, routing, state management. |
| `ui-builder` | Implements screens/components against the design conventions in `frontend/CLAUDE.md`. |
| `code-reviewer` | Reviews diffs for security issues (privacy leaks, missing auth checks) before merge. |

### 10.3 Skills (`.claude/skills/`) — for reducing repeated token spend

Skills encode the repo's recurring patterns once, so Claude doesn't re-derive them every time:

| Skill | Purpose |
|---|---|
| `mongoose-schema-skill` | Standard schema boilerplate (timestamps, indexes, ref population) so schemas aren't re-explained each time one is created. |
| `express-route-skill` | Standard route/controller/validation scaffold. |
| `socket-event-skill` | Standard emit/listen/ack pattern used across all socket events. |
| `supabase-upload-skill` | Reusable signed-URL upload helper + client-side compression snippet. |
| `groq-call-skill` | Reusable wrapper for Groq STT/translation calls, including error handling and the caching pattern. |
| `privacy-check-skill` | The single canonical privacy-enum check function, referenced instead of rewritten in every route. |
| `react-component-skill` | Component scaffold matching the design conventions (props shape, styling approach). |

---

## 11. Build Order

1. Repo scaffold + CLAUDE.md files + agents/skills (this document, sections 3, 10).
2. Data models + DB connection.
3. Auth (signup/login, JWT access + refresh tokens, rate limiting).
4. Friend system + privacy-check skill.
5. User search by phone number.
6. Chat + Message CRUD (text/emoji first).
7. Media messages (photo/voice/PDF) via Supabase.
8. Socket.io real-time messaging + presence + read receipts.
9. Groq voice-to-text (editable transcript).
10. Groq translation.
11. Stories.
12. Optional enhancements (block user, edit/delete window, typing indicators, reactions, story TTL, Redis presence, translation cache).

---

## 12. Optional Enhancements (toggle as needed — all free/no external paid service required)

- [ ] Block user
- [ ] Story 24h auto-expiry (TTL index — free, built into MongoDB)
- [ ] Redis-based presence instead of MongoDB writes per heartbeat (Redis has a free tier / can run locally in dev)
- [ ] Translation result caching (reduces Groq API calls, still within Groq's free tier)
- [ ] Client-side image compression before upload
- [ ] Push notifications — skipped by default since FCM setup has some overhead; add later if needed

> Note: OTP/SMS verification and any paid rate-limiting service are intentionally excluded from this build since they require a paid SMS provider (Twilio, etc.). Basic rate limiting is still included in section 4.1 via the free `express-rate-limit` package — no external service needed.

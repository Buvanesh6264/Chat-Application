# Chat App

Telegram-style real-time messaging app: text, photos, voice messages, PDFs, emoji, phone-number auth, friend-gated profiles, stories, AI voice transcription, and AI translation.

## Stack

- **Frontend**: React (Vite), Socket.io-client, Zustand
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB (Mongoose)
- **Media storage**: Supabase Storage
- **AI**: Groq API (speech-to-text + translation)
- **Auth**: Phone number + password, JWT (access + refresh)

## Getting started

```bash
npm install
cp backend/.env.example backend/.env      # fill in real values
cp frontend/.env.example frontend/.env    # fill in real values
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Project layout

- `backend/` — Express API + Socket.io server. See `backend/CLAUDE.md` for conventions.
- `frontend/` — React (Vite) client. See `frontend/CLAUDE.md` for conventions.
- `.claude/agents/` — subagents scoped to specific parts of the codebase.
- `.claude/skills/` — recurring patterns (schema, route, socket-event, upload, AI-call, privacy-check, component scaffolds).

## Testing

```bash
npm test
```

Backend tests use Vitest + Supertest + `mongodb-memory-server` (no real MongoDB required). Frontend tests use Vitest + Testing Library.

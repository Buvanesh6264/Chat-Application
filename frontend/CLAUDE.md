# Frontend — Chat App

## Tech stack

React 19 + Vite, `react-router-dom` 7 for routing. **Zustand** for high-frequency chat state (messages, typing, presence) via selector-based subscriptions; **React Context** (`AuthProvider`) for the low-frequency auth session only. This split is deliberate — do not move auth into Zustand or chat state into Context.

## Env vars

`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — read via `import.meta.env`, never hardcoded in components. Always go through `services/api.js` / `services/socket.js` / `services/supabaseClient.js`, never construct a raw URL inline.

Note: the frontend only ever holds the Supabase **anon/public** key. The service-role key lives in `backend/.env` and must never reach this package.

## Component conventions

- **Folder-per-feature**, not folder-per-type: `components/chat/`, `components/profile/`, `components/stories/`, `components/common/` (shared primitives only — Button, Modal, Avatar).
- Naming: `PascalCase.jsx` per component, matching the exported name.
- Pages live in `pages/`, one file per route (`LoginPage.jsx`, `ChatRoomPage.jsx`, etc.).
- See `.claude/skills/react-component-skill/SKILL.md` for the full pattern (selector usage, prop conventions).

## State management boundaries

- `store/chatStore.js` (Zustand): `messagesByChatId`, `typingByChatId`, `presenceByUserId`. Read via selectors — `useChatStore((s) => s.messagesByChatId[chatId])`, never destructure the whole store.
- `store/uiStore.js` (Zustand): ephemeral UI state (active modal, toasts-in-flight).
- `context/AuthProvider.jsx` (Context): `user`, `login`, `signup`, `logout`. Consumed via `hooks/useAuth.js`.
- Local component state: form inputs, transient UI toggles — nothing that needs to survive a re-mount or be shared cross-component.

## Auth token handling

- Access token is kept **in memory only** (a module-level variable in `services/api.js`), never `localStorage` — reduces XSS token-theft surface.
- Refresh token is an **httpOnly cookie** set by the backend, invisible to JS. `services/api.js`'s axios instance uses `withCredentials: true`.
- An axios response interceptor catches `401`, calls `POST /auth/refresh` once (deduped via a shared in-flight promise so concurrent 401s don't trigger parallel refreshes), retries the original request with the new access token, and on refresh failure clears the token and rejects (the `ProtectedRoute` guard then redirects to `/login`).
- The socket connects by passing the in-memory access token in the `auth` payload of the `io()` handshake (`services/socket.js`), and reconnects with a fresh token via `reconnectSocketWithFreshToken()` after any refresh.

## Design conventions

Placeholder until a dedicated design pass — document real values here once chosen:

- **Spacing scale**: 4 / 8 / 12 / 16 / 24 / 32 px.
- **Color tokens**: primary / secondary / surface / error / success (hex values TBD).
- **Icon set**: TBD (e.g. `lucide-react`).
- **Story ring / avatar pattern**: Telegram-style ring around avatars with unviewed stories.

## Routing

`router.jsx` defines the route table via `createBrowserRouter`. `/login` and `/signup` are public; everything else is nested under `components/common/ProtectedRoute.jsx`, which redirects to `/login` if there's no authenticated user.

## Commands

```bash
npm run dev      # vite dev server on :5173, proxies /api to :5000
npm test         # vitest run
npm run lint     # eslint .
```

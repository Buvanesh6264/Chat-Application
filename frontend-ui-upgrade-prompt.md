# Frontend UI/UX Upgrade + Feature Prompt

> Paste this to Claude Code working in the `frontend/` half of the existing chat-app repo. It assumes the backend/data models from the original build prompt already exist. Update `frontend/CLAUDE.md` with the design system in section 1 once it's approved, so future UI work stays consistent.

## 0. Instructions to Claude Code

1. Read the existing `frontend/CLAUDE.md` and current component structure before changing anything — extend it, don't fight it.
2. Propose the design token system in section 1 first (colors, type, signature element) and confirm before wiring it into every component.
3. Then implement, in order: design system → auth pages + guard → home layout → chat list (search/pin) → profile page → settings/privacy page → logout.
4. Respect `prefers-reduced-motion` everywhere animation is added.
5. Every new screen must be responsive down to a ~375px mobile width — verify, don't assume.

---

## 1. Design System (derive from the app logo)

The logo is a glossy 3D chat-bubble icon in a blue → violet → magenta gradient with a soft white three-dot glyph. Build the whole UI around this identity instead of a generic Tailwind default palette.

**Color tokens** (adjust slightly to taste, but keep the gradient family):
- `--gradient-primary`: linear-gradient from `#4F46E5` (indigo) → `#9333EA` (violet) → `#EC4899` (magenta) — used for primary buttons, active states, the send button, unread badges.
- `--bg-surface`: `#FAFAFF` (very light lavender-white) for light mode background.
- `--bg-elevated`: `#FFFFFF` for cards/panels, with a soft shadow, not a hard border.
- `--bg-dark`: `#1E1B3A` deep indigo-navy, for dark mode background.
- `--accent-online`: `#10B981` (mint green) — reserved only for online-status dots, so it doesn't compete with the brand gradient.
- `--text-primary`: `#1F2937`, `--text-secondary`: `#6B7280`.

**Typography:**
- Display/heading face: a rounded, friendly sans (e.g. **Sora** or **Poppins**) — used sparingly for page titles and the logo wordmark.
- Body face: **Inter** for everything else (messages, forms, lists) — optimized for readability at small sizes.

**Signature element:** an animated gradient ring that appears around a user's avatar when they're online, echoing the logo's gradient — this is the one recurring "brand moment" used across chat list, profile, and header. Keep everything else calm around it.

**Motion principles:**
- Page-load: a single soft fade + slight upward slide (150–250ms) for main content — not per-element cascades everywhere.
- Micro-interactions: buttons scale down slightly on press (~0.97), inputs get a soft gradient-glow focus ring instead of a plain blue outline.
- Chat bubbles: new messages slide/fade in from the bottom.
- Avoid excessive simultaneous animation — one orchestrated moment per screen reads better than scattered effects.

---

## 2. Auth Pages (Login / Signup)

Current state: functional but bare (just two fields). Redesign both pages:

- Split-panel layout on desktop: left panel is a branded gradient panel featuring the logo mark and a short welcoming line ("Message your people, beautifully" or similar — write in the app's own voice); right panel holds the form. On mobile, collapse to just the form with the logo centered on top.
- Inputs: floating/animated labels, gradient focus ring, inline validation messages (shake animation on error, not just red text).
- Primary button uses `--gradient-primary`, with a loading spinner state while the request is in flight.
- Add a subtle ambient background animation behind the branded panel (e.g. slow-moving soft gradient blobs) — restrained, not distracting.
- Toggle link between "Don't have an account? Sign up" / "Already have an account? Log in".

### Auth guard (route protection)
- If a user has a valid session (valid access token / refreshable session), visiting `/login` or `/signup` directly must redirect them straight to the home/chat screen — they should never see the login form again until they explicitly log out.
- Implement as a top-level route guard (e.g. `<PublicOnlyRoute>` wrapping `/login` and `/signup`, `<PrivateRoute>` wrapping everything else), checked against auth context state on app load (including a silent refresh-token check before deciding).
- Logout must clear both tokens and any cached user state, then redirect to `/login`.

---

## 3. Home Screen Layout

**Desktop / tablet landscape (split-pane):**
```
┌───────────────┬─────────────────────────────┐
│  Chat list     │        Active chat          │
│  (search bar)  │   (header, messages, input) │
│  - pinned      │                             │
│  - recent      │                             │
└───────────────┴─────────────────────────────┘
```
- Left pane: fixed width (~320–360px), scrollable independently of the right pane.
- Right pane: shows the active conversation; shows an empty/inviting placeholder state ("Select a chat to start messaging") when nothing is selected yet.

**Mobile (single column, tab/stack navigation):**
- Show only the chat list by default.
- Tapping a user opens the chat as a full-page view (slide-in transition from the right) with a back button in the header returning to the list.
- Use the same components for both layouts — just change the container/routing behavior at the breakpoint (e.g. Tailwind `lg:` split vs. stacked below it), so there's one source of truth for chat UI.

## 4. Chat List (left pane / mobile list)

- Search bar at the top — search by name or phone number, filters the list live as the user types (debounce ~250ms).
- **Pinned section** above the regular list: user can pin/unpin a chat (long-press on mobile, right-click or a "⋯" menu on desktop). Persist pinned state on the backend (add `pinnedChats: [ObjectId ref Chat]` to the `User` model) so it survives refresh/device switch.
- Each row: avatar (with the online-gradient ring signature element when applicable), name, last message preview (truncated), timestamp, unread-count badge using the gradient, and a small read-receipt tick when applicable.
- Empty state for a brand-new account: friendly illustration/text inviting them to search and start a chat.

## 5. Profile Page

- Shows the user's own profile: avatar, name, phone number, bio.
- **Change profile photo:** click/tap avatar → file picker → client-side crop/preview → upload to Supabase Storage (reuse the `supabase-upload-skill` pattern from the backend prompt) → update `profileImageUrl` on save. Show an upload-progress state and a clear success confirmation.
- Editable fields (name, bio) with a single "Save changes" action; disable it until something actually changed.
- Link out to the Settings page from here.

## 6. Settings / Privacy Page

This was discussed in the original spec but never actually wired up — implement it for real against the existing `privacySettings` fields on the `User` model:

- Three clearly labeled controls, each a segmented control or dropdown with options **Everyone / Friends / Nobody**:
  - Who can see my profile info (photo, phone number)
  - Who can see my last seen time
  - Who can see my online status
- A separate toggle for **read receipts** (with the mutual-disable behavior already defined in the backend spec — explain this in the UI copy, e.g. "If you turn this off, you won't see read receipts from others either").
- Save immediately on change (optimistic UI update, revert with a toast if the request fails) rather than requiring a separate "Save" button — settings toggles should feel instant.
- Include a **Logout** action here too (in addition to a persistent logout button described below), with a confirmation step.

## 7. Logout

- Add a persistent, easy-to-find logout button/icon (e.g. in a header/profile menu, not buried only in settings).
- Confirm before logging out ("Are you sure you want to log out?").
- On confirm: revoke the refresh token server-side, clear local auth state, redirect to `/login`.

---

## 8. Acceptance Checklist

- [ ] Login/signup pages redesigned with the gradient identity, animated inputs, loading/error states.
- [ ] Logged-in users are redirected away from `/login` and `/signup`; only `logout` gets them back there.
- [ ] Home screen splits into list + chat panel on desktop/tablet, and stacks with full-page chat + back navigation on mobile.
- [ ] Chat list has working search, a persisted pinned section, unread badges, and online-ring avatars.
- [ ] Profile page supports image upload to Supabase with preview/progress/success states.
- [ ] Settings page actually reads/writes the three privacy enums and the read-receipts toggle, with instant save feedback.
- [ ] Logout button present in at least two logical places (header/profile menu + settings), with confirmation.
- [ ] All new screens verified responsive at ~375px width and respect `prefers-reduced-motion`.

# Bug Fixes + Group Chat Feature — Backend & Frontend Prompt

> Paste this to Claude Code with access to the full repo (both `backend/` and `frontend/`). Several items below are bugs where the backend data/logic is likely the root cause even though they show up as frontend symptoms — fix the backend first, then verify the frontend consumes it correctly, for each one.

## 0. Instructions to Claude Code

1. Work bug fixes first (section 1), new group feature second (section 2). Don't mix them in the same commit/PR.
2. For every "bug," first find and state the root cause (backend query, missing field, missing socket event, or frontend not re-fetching) before patching — don't just patch symptoms on the frontend if the data itself is wrong.
3. After each fix, describe how you verified it (e.g. "reloaded the page and confirmed pinned chat stayed at top").

---

## 1. Bug Fixes

### 1.1 Friends list not showing accepted friends
Likely cause: `POST /friends/respond` (accept) isn't pushing both users into each other's `friends[]` array atomically, or the friends-list endpoint isn't populating/returning it correctly.
- Fix: on accept, update **both** users' `friends` array in a single transaction (or two writes wrapped in try/catch with rollback) — add each user's `_id` to the other's `friends[]`.
- Ensure `GET /friends` returns the populated list (name, avatar, phone, online status per the privacy rules already defined).
- Frontend: call this endpoint on Profile/Friends page mount, don't rely on stale cached state from the request flow.

### 1.2 Unread message "pending" count
- Add `unreadCounts: [{ userId, count }]` to the `Chat` model (or a lightweight separate `unread` collection if you prefer keeping `Chat` lean).
- On `message:send`, increment the recipient's counter for that chat via the socket handler; emit a `chat:unreadUpdate` event so their chat list updates live without a refresh.
- On opening a chat / marking messages read, reset that user's counter to 0 and emit the same event.
- Frontend: show the count as a small badge on the chat-list row (e.g. "1", "3", "9+" past 9) using the gradient accent color from the design system — not plain red, to stay on-brand.

### 1.3 Pinned chat not persisting after reload
Root cause is almost certainly that the frontend isn't fetching persisted pin state on load, or the backend isn't returning it.
- Backend: confirm `pinnedChats: [ObjectId ref Chat]` on `User` (add if missing), with `PATCH /users/me/pin-chat/:chatId` to toggle, and make sure `GET /chats` (or `GET /users/me`) includes the current pinned list.
- Frontend: on app load, fetch the pinned list from the backend and use it to sort/section the chat list — do not rely only on local component state, which resets on reload. Pinned chats must always render in the pinned section above regular chats, every time, regardless of refresh.

### 1.4 Friend request notification missing
- Backend: `GET /friends/requests/pending` returns incoming pending requests for the logged-in user; emit a `friend:request:new` socket event to the recipient the moment a request is created, so the badge can update live.
- Frontend: show a small notification badge (count) near the profile icon or the "new chat" button — whichever is the primary entry point in your current header — that updates in real time and clears once the requests are viewed/actioned.

### 1.5 Profile page has no back navigation
- Add a back button/icon in the Profile page header that returns to wherever the user came from (use router history back, falling back to the home screen if there's no history — e.g. deep link directly to profile).

### 1.6 Layout ratio and responsiveness
Current split isn't the right ratio and doesn't respond well across sizes.
- Set the split explicitly to **30% chat/user list : 70% active chat** on desktop/tablet (e.g. CSS Grid `grid-template-columns: 30% 70%` or flex-basis equivalents), with sensible min-widths (e.g. list pane min 280px) so it doesn't crush at odd viewport sizes.
- Re-verify the mobile breakpoint (single column, full-page chat with back button) still works correctly at this new ratio — the 30/70 split should only apply at the `lg:` breakpoint and above.

### 1.7 Dark mode text visibility
Audit every screen in dark mode — text is currently unreadable in places, which usually means some components are using hardcoded light-mode colors instead of theme tokens.
- Standardize dark-mode tokens: `--text-primary-dark: #F3F4F6`, `--text-secondary-dark: #9CA3AF`, `--bg-dark: #1E1B3A` (already defined), `--surface-dark: #2A2650` for cards/bubbles/inputs.
- Go component by component and replace any hardcoded `text-gray-900`, `bg-white`, etc. with theme-aware equivalents (Tailwind `dark:` variants or CSS variables) so nothing silently falls back to invisible dark-on-dark text.
- Check contrast meets at least WCAG AA (4.5:1) for body text in both modes.

### 1.8 Message bubble colors too light / not distinct enough
- **Own messages:** use a solid, more saturated color from the brand gradient family rather than a pale tint — e.g. solid `#6D28D9` (deep violet) with white text in light mode, and a slightly brighter `#8B5CF6` in dark mode for contrast against the dark background.
- **Other user's messages:** a clearly distinct, higher-contrast neutral — e.g. `#E5E7EB`-ish light gray with dark text (`#1F2937`) in light mode, and `#332F55`-ish slate with near-white text in dark mode.
- Concretely: increase saturation/darkness roughly 50% versus whatever the current bubble colors are — the goal is that own vs. other messages are immediately distinguishable at a glance, and text is never low-contrast against its bubble in either mode.

---

## 2. New Feature: Group Chats

### 2.1 Data model
Extend the existing `Chat` model rather than introducing a separate collection:
```
Chat {
  ...existing fields,
  isGroup: Boolean,
  groupName: String,          // required if isGroup
  groupAvatarUrl: String,
  leaderId: ObjectId ref User, // set only if isGroup
  participants: [ObjectId ref User]
}
```

### 2.2 Rules
- **Creation:** a user can only create a group by selecting members from their own accepted friends list — non-friends must not be selectable in the member picker.
- **Leadership:** the creator becomes `leaderId` automatically.
- **Adding members:** only the current `leaderId` can add new members to an existing group, and only from the *leader's* friends list (not the friends of other members) — enforce this server-side, not just by hiding the UI control.
- [Optional, confirm before building] Leader can remove members; leadership transfer.

### 2.3 API / Sockets
```
POST   /chats/group                 (create group: name, avatar, initial memberIds — validated against caller's friends)
POST   /chats/group/:id/members     (add member — leader-only, validated against leader's friends)
DELETE /chats/group/:id/members/:userId   (optional: remove member — leader-only)
```
- Reuse existing `message:send` / `message:receive` socket flow for group messages — no new event types needed, just `chat.isGroup === true` and `participants.length > 2`.

### 2.4 Frontend
- "New Group" entry point next to "New Chat," opening a member picker that only lists friends.
- Group chat row in the chat list shows the group avatar/name instead of a single user's.
- Inside a group chat, show sender name above/beside each message bubble (since multiple people can send messages, unlike 1:1 chats).
- "Add member" control visible only to the leader, opening the same friends-only picker, filtered to exclude existing members.

---

## 3. Acceptance Checklist

- [ ] Accepted friends actually appear in the friends list (verified after a fresh accept, not just cached state).
- [ ] Unread count badge appears and updates live, resets on opening the chat.
- [ ] Pinned chats stay pinned and on top after a full page reload.
- [ ] Friend request badge appears near profile/new-chat button and updates in real time.
- [ ] Profile page has a working back button.
- [ ] Desktop/tablet layout is a true 30/70 (list/chat) split and remains usable at various widths; mobile still stacks correctly.
- [ ] Dark mode: no unreadable text anywhere, verified on every screen (auth, home, chat, profile, settings).
- [ ] Own vs. other message bubbles are visually distinct with solid, sufficiently saturated colors and readable text in both light and dark mode.
- [ ] Groups can only be created from friends; only the leader can add members, and only from the leader's friends list — enforced server-side.

# Friends Management, Chat Fixes, Group Admins & Chat Layout — Backend & Frontend Prompt

> Paste this to Claude Code with access to the full repo (`backend/` and `frontend/`). Covers every item below — none are optional. Work backend first for anything with new data/endpoints, then wire the frontend to it.

## 0. Instructions to Claude Code

1. Implement in this order: (1) Friends management, (2) Reaction-picker bug fix, (3) Group edit/admin/avatar, (4) Chat list separation, (5) Message layout + avatars, (6) Profile-from-chat + friend request, (7) Panel color distinction.
2. For the reaction bug specifically: find the actual CSS/DOM cause (overflow clipping, missing z-index, or wrong positioning context) and state it before patching.
3. Everything must work in both light and dark mode, and remain responsive at mobile widths.

---

## 1. Friends Management (Profile → Friends)

Currently the friends section only shows accepted friends. Extend it to a full friends management view:

**Backend**
- `DELETE /friends/:friendId` — removes each user from the other's `friends[]` array (both sides, atomically).
- `GET /friends/requests/sent` — returns the logged-in user's outgoing pending requests (populated with recipient info).
- `DELETE /friends/requests/:requestId` — cancels a pending outgoing request (only the sender may cancel their own request; delete the `FriendRequest` doc or mark it `cancelled`).
- Keep existing `GET /friends/requests/pending` (incoming) and `POST /friends/respond` untouched.

**Frontend**
- Friends page has three sections: **Friends** (each row has a "Remove" action with a confirm step), **Sent Requests** (each row has a "Cancel" action), **Received Requests** (existing accept/decline, if not already there).
- Removing a friend should also update anything that depends on the friend relationship live (e.g. that user disappears from the group-member picker, their profile visibility reverts per privacy settings) — no stale state after the action.

---

## 2. Bug: Reaction picker not showing / getting hidden

Symptoms: clicking the react button doesn't show the picker, and/or a chosen reaction disappears/gets clipped.

**Root cause to check first:** this is almost always the message-list container having `overflow: hidden` or `overflow-y: auto` while the reaction picker is a child element trying to render outside those bounds, or the picker having a lower `z-index` than sibling bubbles/the input bar.

**Fix approach**
- Render the reaction picker as a portal (or fixed/absolute positioned relative to the viewport, not the scrollable message container) so it isn't clipped by the chat scroll area.
- Give it a `z-index` above the message list and input bar.
- Position it relative to the clicked message (open above the bubble if opening below would go off-screen near the bottom of the viewport — flip logic based on available space).
- Once a reaction is picked, confirm it renders attached to the message bubble itself (not inside the now-closed picker) and persists after re-render/scroll.
- Test on both desktop and mobile widths — the clipping bug is likely worse on mobile where space is tighter.

---

## 3. Group Chat: Edit, Multiple Admins, Group Avatar

**Backend**
- Extend the `Chat` model (group case): add `admins: [ObjectId ref User]` alongside the existing `leaderId`. Leader is implicitly an admin; `admins[]` holds additional promoted members.
- `PATCH /chats/group/:id` — edit `groupName` / `groupAvatarUrl`. Allowed for `leaderId` or anyone in `admins[]`.
- `POST /chats/group/:id/admins/:userId` — promote a member to admin. Leader-only.
- `DELETE /chats/group/:id/admins/:userId` — demote an admin. Leader-only.
- Update the "add member" rule from the earlier group spec: **leader or any admin** may add members (previously leader-only) — still validated against *that admin's own* friends list, same as before.
- Group avatar upload reuses the same Supabase upload flow as profile photos.

**Frontend**
- Group info screen: edit name and avatar (visible/enabled only for leader/admins).
- Member list shows a role tag (Leader / Admin / Member). Leader sees a "Make admin" / "Remove admin" action per member; admins do not see this control (leader-only).
- Admins see the "Add member" control (previously leader-only); regular members do not.

---

## 4. Separate Group Chats from Direct Chats

**Frontend**
- Split the chat list into two clearly labeled sections or tabs: **Direct Messages** and **Groups** (pinned items still float to the top within their own list, or keep one combined pinned section at the very top above both — pick whichever reads cleaner, but keep pinned chats visible regardless of type).
- Group rows show the group avatar/name (already covered); direct rows show the other user's avatar/name as before.

---

## 5. Message Layout with Avatars

Implement the standard chat layout: incoming messages show the sender's avatar on the **left** with the bubble following it; outgoing (your own) messages align to the **right** with no avatar (or optionally your own small avatar on the right if you want symmetry — default to no avatar on your own messages, Telegram-style).

```
[avatar] Hi                       →  incoming, left-aligned
                        Hello  [→]   outgoing, right-aligned
```
- In group chats, also show the sender's name in a small label above/beside their bubble (only for incoming messages, since outgoing are obviously yours) so it's clear who said what.
- Consecutive messages from the same sender within a short time window can collapse the avatar to only the last message in the run (standard chat UX), to avoid repeating it every line — implement this if straightforward, otherwise show it on every message.

---

## 6. View Other User's Profile from Chat + Send Friend Request

**Frontend**
- Clicking the other user's avatar or name in the chat header (1:1 chats) opens their profile view (modal or slide-over — pick whichever fits the existing navigation pattern).
- Profile view respects the same privacy rules as elsewhere (only shows protected fields if they're friends / privacy setting allows it).
- If the viewer and the profile owner are **not already friends** (and no pending request exists), show a **"Send Friend Request"** button in this view. If a request is already pending, show "Request Sent" (disabled) instead of the button, reusing the sent-requests logic from section 1.

---

## 7. Distinct Panel Colors

Right now the list panel, chat panel, and any side/detail panel likely share the same background, making the layout feel flat. Extend the design system tokens:
- `--bg-panel-list` — chat/user list panel background.
- `--bg-panel-chat` — active chat panel background.
- `--bg-panel-detail` — profile/settings/group-info panel background.

Pick values that are close in tone (don't fight the existing gradient identity) but distinguishable — e.g. list panel very slightly cooler/lighter than the chat panel, so the eye can tell them apart without needing a hard border. Define both light and dark mode variants for each and apply consistently.

---

## 8. Acceptance Checklist

- [ ] Friends page: can remove a friend, can see and cancel sent/outgoing friend requests, existing incoming request flow untouched.
- [ ] Reaction picker opens reliably on click, is never clipped/hidden, and chosen reactions persist visibly on the bubble.
- [ ] Group info can be edited (name/avatar) by leader/admins; leader can promote/demote admins; admins can add members from their own friends list.
- [ ] Chat list visibly separates Direct Messages and Groups.
- [ ] Message layout matches the avatar-left/incoming vs. right/outgoing format, with sender name shown for incoming group messages.
- [ ] Clicking another user's avatar/name in a chat opens their profile, with a working Send Friend Request button when not already friends or pending.
- [ ] List, chat, and detail panels are visually distinguishable via distinct (but harmonious) background tokens in both light and dark mode.

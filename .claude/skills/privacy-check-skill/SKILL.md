---
name: privacy-check-skill
description: The single canonical privacy-enum check used by every route/socket that reads profile, story, presence, or last-seen data — referenced instead of rewritten per call site.
---

# Privacy check pattern

Every read of profile fields, story visibility, online status, or last-seen goes through `services/privacy.js`'s single exported check — never reimplemented inline in a route or socket handler.

**Decision table** for a field gated by `Everyone | Friends | Nobody`:

| Setting | Visible to |
|---|---|
| `Everyone` | any authenticated user (subject to the blocked-user short-circuit below) |
| `Friends` | only users with an `accepted` `FriendRequest` relationship to the profile owner |
| `Nobody` | only the profile owner themself |

**Blocked-user short-circuit** (checked first, before the enum): if either user has the other in `blockedUsers`, the result is always "not visible" regardless of the enum setting, and the blocked user is excluded from the blocker's search results entirely (not just profile reads).

**Stories always override to friends-only**: regardless of `profileVisibility`/other settings, a story is visible only to users in the poster's `friends[]` array — there is no `Everyone`/`Nobody` option for stories.

**Shape of the helper** (`services/privacy.js`):
```js
export const canView = async (viewerId, ownerId, field) => {
  // field: 'profile' | 'lastSeen' | 'onlineStatus' | 'story'
  // returns boolean; checks blocked-users first, then friends[], then the relevant enum
};
```
Call this from every controller/socket handler that returns profile/story/presence data — do not duplicate the friends/blocked lookup per call site.

import { User } from '../models/User.js';

const PRIVACY_SETTING_BY_FIELD = {
  profile: 'profileVisibility',
  lastSeen: 'lastSeenVisibility',
  onlineStatus: 'onlineStatusVisibility',
};

// A hard block is independent of and overrides the visibility enums below — it hides existence
// entirely (see getProfile), whereas the enums gate individual fields on an otherwise-visible user.
export const isBlockedPair = (a, b) =>
  a.blockedUsers.some((id) => id.equals(b._id)) || b.blockedUsers.some((id) => id.equals(a._id));

const isFriend = (owner, viewerId) => owner.friends.some((id) => id.equals(viewerId));

// Field-level check against already-fetched documents — use this when checking multiple fields
// for the same viewer/owner pair (e.g. a profile read) to avoid re-fetching per field.
// profileVisibility, lastSeenVisibility, and onlineStatusVisibility are independent per spec —
// callers must check each field separately, never let one field's result gate another.
export const canViewField = (viewer, owner, field) => {
  if (viewer._id.equals(owner._id)) return true;
  if (isBlockedPair(owner, viewer)) return false;

  if (field === 'story') {
    return isFriend(owner, viewer._id);
  }

  const setting = owner.privacySettings[PRIVACY_SETTING_BY_FIELD[field]];
  if (setting === 'Everyone') return true;
  if (setting === 'Nobody') return false;
  return isFriend(owner, viewer._id); // 'Friends'
};

// The single canonical privacy check — every route/socket reading profile, story, presence, or
// last-seen data must go through this (or canViewField, if the documents are already in hand)
// instead of reimplementing the Everyone/Friends/Nobody decision
// (see .claude/skills/privacy-check-skill/SKILL.md).
export const canView = async (viewerId, ownerId, field) => {
  if (viewerId.toString() === ownerId.toString()) return true;

  const [owner, viewer] = await Promise.all([User.findById(ownerId), User.findById(viewerId)]);
  if (!owner || !viewer) return false;

  return canViewField(viewer, owner, field);
};

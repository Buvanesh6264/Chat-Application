import { User } from '../models/User.js';

// In-memory only — interface-swappable to Redis later without touching call sites.
// userId -> Set<socketId>, so a user with multiple tabs/devices only goes "offline" when
// their last socket disconnects, not their first.
const onlineSockets = new Map();

// Returns true only on a genuine offline -> online transition, so callers (presence.handlers.js)
// know whether to broadcast — an extra tab connecting shouldn't re-announce presence.
export const setOnline = async (userId, socketId) => {
  const key = userId.toString();
  const existing = onlineSockets.get(key);
  const wasOffline = !existing || existing.size === 0;
  const sockets = existing ?? new Set();
  sockets.add(socketId);
  onlineSockets.set(key, sockets);

  if (wasOffline) {
    await User.findByIdAndUpdate(key, { isOnline: true });
  }
  return wasOffline;
};

// Returns true only on a genuine online -> offline transition (this was the last socket).
export const setOffline = async (userId, socketId) => {
  const key = userId.toString();
  const sockets = onlineSockets.get(key);
  if (!sockets) return false;

  sockets.delete(socketId);
  if (sockets.size > 0) return false;

  onlineSockets.delete(key);
  await User.findByIdAndUpdate(key, { isOnline: false, lastSeenAt: new Date() });
  return true;
};

export const isOnline = (userId) => onlineSockets.has(userId.toString());

export const getLastSeen = async (userId) => {
  const user = await User.findById(userId).select('lastSeenAt');
  return user?.lastSeenAt ?? null;
};

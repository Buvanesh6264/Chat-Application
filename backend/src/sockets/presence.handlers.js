import { User } from '../models/User.js';
import * as presence from '../services/presence.js';
import { canViewField } from '../services/privacy.js';

// Proactive presence pushes go to friends only — a bounded, known list — rather than a global
// broadcast even for onlineStatusVisibility: 'Everyone'. Non-friend viewers still get correct
// current data on-demand via the existing GET /users/:id/profile REST read.
const broadcastPresenceToFriends = async (io, userId, isOnline, lastSeenAt) => {
  const owner = await User.findById(userId);
  if (!owner || owner.friends.length === 0) return;

  const friends = await User.find({ _id: { $in: owner.friends } });
  for (const friend of friends) {
    const canSeeOnline = canViewField(friend, owner, 'onlineStatus');
    const canSeeLastSeen = canViewField(friend, owner, 'lastSeen');
    if (!canSeeOnline && !canSeeLastSeen) continue;

    io.to(`user:${friend._id}`).emit('presence:update', {
      userId,
      isOnline: canSeeOnline ? isOnline : null,
      lastSeenAt: canSeeLastSeen ? lastSeenAt : null,
    });
  }
};

export const registerPresenceHandlers = (io, socket) => {
  const userId = socket.data.userId;

  presence
    .setOnline(userId, socket.id)
    .then((transitioned) => transitioned && broadcastPresenceToFriends(io, userId, true, null))
    .catch((err) => console.error('presence setOnline failed:', err.message));

  socket.on('disconnect', () => {
    presence
      .setOffline(userId, socket.id)
      .then(async (transitioned) => {
        if (!transitioned) return;
        const lastSeenAt = await presence.getLastSeen(userId);
        await broadcastPresenceToFriends(io, userId, false, lastSeenAt);
      })
      .catch((err) => console.error('presence setOffline failed:', err.message));
  });
};

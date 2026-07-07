import { ApiError } from '../utils/ApiError.js';
import { Story } from '../models/Story.js';
import { User } from '../models/User.js';
import { validateMediaUpload } from './mediaValidation.js';
import { canView } from './privacy.js';
import { emitToUser } from './realtime.js';
import { createDownloadUrl } from './storage.js';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// Photo only, no video — the spec never mentions video and Story has no type/mediaMeta field to
// store it against; reuses the existing 'photo' category so no media-allowlist changes are needed.
export const createStory = async ({ userId, objectKey, caption }) => {
  await validateMediaUpload(userId, 'photo', objectKey);

  const story = await Story.create({
    userId,
    mediaUrl: objectKey,
    caption: caption || '',
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
  });

  const owner = await User.findById(userId);
  // Not serializeStory(story, userId) — that's owner-perspective (viewedBy: [], viewedByMe for
  // the poster) and would leak the viewedBy field to recipients who aren't the owner. A
  // brand-new story has no per-viewer state yet, so the broadcast payload reflects that plainly
  // rather than reusing the REST response's owner-scoped shape.
  const broadcastPayload = {
    id: story._id,
    userId: story.userId,
    mediaUrl: await createDownloadUrl(story.mediaUrl),
    caption: story.caption,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewedByMe: false,
  };
  // Friends[] already *is* the exact visibility set for stories — no per-field privacy branching
  // needed here (unlike presence, which has independent Everyone/Friends/Nobody enums to check).
  // Include the poster's own room too, mirroring message:receive's "notify the sender's other tabs."
  for (const friendId of [...owner.friends, userId]) {
    emitToUser(friendId, 'story:new', broadcastPayload);
  }

  return story;
};

// friends[] already excludes blocked pairs by construction (blockUser pulls both users out of
// each other's friends[]) — no separate isBlockedPair check needed here.
export const getFeed = async (userId) => {
  const owner = await User.findById(userId);
  const visibleUserIds = [...owner.friends, userId];

  return Story.find({
    userId: { $in: visibleUserIds },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

export const viewStory = async ({ viewerId, storyId }) => {
  const story = await Story.findOne({ _id: storyId, expiresAt: { $gt: new Date() } });
  if (!story) {
    throw new ApiError(404, 'Story not found');
  }

  // Don't leak existence of a non-friend's story via a distinguishable error.
  const allowed = await canView(viewerId, story.userId, 'story');
  if (!allowed) {
    throw new ApiError(404, 'Story not found');
  }

  // Viewing your own story doesn't count as a "view" — don't add the owner to their own list.
  if (story.userId.toString() !== viewerId.toString()) {
    await Story.updateOne({ _id: storyId }, { $addToSet: { viewedBy: viewerId } });
  }
  return Story.findById(storyId);
};

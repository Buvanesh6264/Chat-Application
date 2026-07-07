import { createDownloadUrl } from '../services/storage.js';

// Viewer-aware, unlike serializeMessage — a story's viewedBy list must only be exposed to its
// own owner (a friend viewing someone else's story shouldn't see who else viewed it), so this
// needs to know who's asking. viewedByMe is returned for everyone regardless of ownership.
export const serializeStory = async (story, viewerId) => {
  const isOwner = story.userId.toString() === viewerId.toString();

  return {
    id: story._id,
    userId: story.userId,
    mediaUrl: await createDownloadUrl(story.mediaUrl),
    caption: story.caption,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewedByMe: story.viewedBy.some((id) => id.toString() === viewerId.toString()),
    viewedBy: isOwner ? story.viewedBy : undefined,
  };
};

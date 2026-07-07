import { createDownloadUrl } from '../services/storage.js';

// Shared between messages.controller.js (direct message reads) and chats.controller.js
// (populated Chat.lastMessage) so a soft-deleted message's content/mediaUrl is masked
// consistently everywhere it's surfaced, not just at the one call site it was first written for.
//
// Async because a present mediaUrl (which stores an objectKey, not a URL — the bucket is
// private) needs a fresh presigned GET generated on every read rather than a permanent link.
export const serializeMessage = async (message) => {
  const deleted = Boolean(message.deletedAt);
  const mediaUrl = !deleted && message.mediaUrl ? await createDownloadUrl(message.mediaUrl) : null;

  return {
    id: message._id,
    chatId: message.chatId,
    senderId: message.senderId,
    type: message.type,
    content: deleted ? null : message.content,
    mediaUrl,
    mediaMeta: message.mediaMeta,
    transcript: deleted ? null : message.transcript,
    transcriptEdited: message.transcriptEdited,
    translatedContent: deleted ? [] : message.translatedContent,
    reactions: message.reactions,
    readBy: message.readBy,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
  };
};

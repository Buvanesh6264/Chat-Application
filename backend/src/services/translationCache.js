import { Message } from '../models/Message.js';

// Message.translatedContent *is* the cache — re-querying Mongo is cheap, the expensive thing to
// avoid is repeat Groq calls. No separate in-memory layer, so there's nothing to keep in sync
// with the DB or invalidate twice.
export const getCachedTranslation = async (messageId, language) => {
  const message = await Message.findById(messageId).select('translatedContent');
  return message?.translatedContent.find((entry) => entry.language === language)?.text ?? null;
};

// Idempotent: pull-then-push, same pattern already used for readBy/reactions.
export const setCachedTranslation = async (messageId, language, text) => {
  await Message.updateOne({ _id: messageId }, { $pull: { translatedContent: { language } } });
  await Message.updateOne({ _id: messageId }, { $push: { translatedContent: { language, text } } });
};

// Called when a message's content is edited — a cached translation now describes text that no
// longer exists.
export const invalidateTranslations = async (messageId) => {
  await Message.updateOne({ _id: messageId }, { $set: { translatedContent: [] } });
};

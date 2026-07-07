import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Message } from '../models/Message.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { getParticipantChat } from '../services/chats.js';
import { transcribeVoiceMessage } from '../services/transcription.js';
import { translateText } from '../services/groq.js';
import { getCachedTranslation, setCachedTranslation } from '../services/translationCache.js';

// Automatic transcription already fires on every voice send (services/messages.js#sendMessage) —
// this is a sender-initiated manual re-run for when that silently failed or Groq hiccuped.
export const retranscribe = asyncHandler(async (req, res) => {
  const { messageId } = req.body;

  const message = await Message.findById(messageId);
  if (!message || message.senderId.toString() !== req.user.id) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.type !== 'voice') {
    throw new ApiError(400, 'Only voice messages can be transcribed');
  }

  try {
    const updated = await transcribeVoiceMessage(message._id);
    res.json({ message: await serializeMessage(updated) });
  } catch (err) {
    throw new ApiError(502, `Transcription failed: ${err.message}`);
  }
});

// Recipient-requested-on-read, not sender-picks-before-send (deliberate deviation from the
// spec's literal wording, per .claude/agents/ai-integration.md). Any chat participant may
// request a translation of any message in their own chat.
export const translateMessage = asyncHandler(async (req, res) => {
  const { messageId, targetLanguage } = req.body;

  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) {
    throw new ApiError(404, 'Message not found');
  }
  await getParticipantChat(message.chatId, req.user.id);
  if (!message.content?.trim()) {
    // A voice/photo/pdf message with no caption has nothing to translate — avoid a wasted Groq
    // call and a junk cache entry for an empty string.
    throw new ApiError(400, 'This message has no text content to translate');
  }

  const cached = await getCachedTranslation(messageId, targetLanguage);
  if (cached) {
    return res.json({ language: targetLanguage, text: cached, cached: true });
  }

  let text;
  try {
    text = await translateText(message.content, targetLanguage);
  } catch (err) {
    throw new ApiError(502, `Translation failed: ${err.message}`);
  }
  await setCachedTranslation(messageId, targetLanguage, text);

  res.json({ language: targetLanguage, text, cached: false });
});

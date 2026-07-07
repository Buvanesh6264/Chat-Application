import { ApiError } from '../utils/ApiError.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { isBlockedPair } from './privacy.js';
import { getParticipantChat } from './chats.js';
import { validateMediaUpload } from './mediaValidation.js';
import { MEDIA_MESSAGE_TYPES } from '../utils/mediaTypes.js';
import { transcribeVoiceMessage } from './transcription.js';
import { invalidateTranslations } from './translationCache.js';

const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000;
const TEXT_MESSAGE_TYPES = ['text', 'emoji'];
const ALL_MESSAGE_TYPES = [...TEXT_MESSAGE_TYPES, ...MEDIA_MESSAGE_TYPES];

const withinEditWindow = (message) => Date.now() - message.createdAt.getTime() <= EDIT_DELETE_WINDOW_MS;

// Re-validates required-by-type fields here (not just at the REST express-validator layer),
// since socket payloads have no middleware validation in front of them.
const validatePayloadShape = ({ type, content, objectKey, durationSeconds }) => {
  if (!ALL_MESSAGE_TYPES.includes(type)) {
    throw new ApiError(400, `Unsupported message type "${type}"`);
  }
  if (TEXT_MESSAGE_TYPES.includes(type) && !content?.trim()) {
    throw new ApiError(400, 'content is required for text/emoji messages');
  }
  if (MEDIA_MESSAGE_TYPES.includes(type) && !objectKey) {
    throw new ApiError(400, 'objectKey is required for media messages');
  }
  if (type === 'voice' && (durationSeconds === undefined || durationSeconds === null)) {
    throw new ApiError(400, 'durationSeconds is required for voice messages');
  }
};

// Returns { message, chat } — the chat's participants are what callers (REST controller, socket
// handler) need to know who to respond to / broadcast to, without a second query.
export const sendMessage = async ({ senderId, chatId, type, content, objectKey, durationSeconds }) => {
  validatePayloadShape({ type, content, objectKey, durationSeconds });
  const chat = await getParticipantChat(chatId, senderId);

  if (!chat.isGroup) {
    const otherId = chat.participants.find((id) => id.toString() !== senderId.toString());
    const [me, other] = await Promise.all([User.findById(senderId), User.findById(otherId)]);
    if (isBlockedPair(me, other)) {
      throw new ApiError(403, 'Cannot message this user');
    }
  }

  const messageData = { chatId, senderId, type, content: content || '' };

  if (MEDIA_MESSAGE_TYPES.includes(type)) {
    const verified = await validateMediaUpload(senderId, type, objectKey);
    messageData.mediaUrl = objectKey;
    messageData.mediaMeta = {
      mimeType: verified.mimeType,
      size: verified.size,
      durationSeconds: type === 'voice' ? durationSeconds : undefined,
    };
  }

  const message = await Message.create(messageData);
  await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

  if (type === 'voice') {
    // Fire-and-forget — a slow/failed Groq call must never block or fail the send itself.
    // Pass only the id: transcribeVoiceMessage re-fetches its own document instance rather than
    // mutating this shared `message` object, which the caller is about to serialize itself.
    transcribeVoiceMessage(message._id).catch((err) => console.error('Voice transcription failed:', err.message));
  }

  return { message, chat };
};

export const editMessageContent = async ({ userId, messageId, content }) => {
  const message = await Message.findById(messageId);
  if (!message || message.senderId.toString() !== userId.toString()) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.deletedAt) {
    throw new ApiError(409, 'Cannot edit a deleted message');
  }
  if (!withinEditWindow(message)) {
    throw new ApiError(403, 'Edit window has expired');
  }

  message.content = content;
  message.editedAt = new Date();
  await message.save();
  // A cached translation now describes text that no longer exists.
  await invalidateTranslations(messageId);

  return message;
};

// Correcting a bad ASR transcription is a different concept from editing what you said — no
// 15-minute time-box (Groq can be slower than that under load, and corrections are legitimate
// well after the fact).
export const editTranscript = async ({ userId, messageId, transcript }) => {
  const message = await Message.findById(messageId);
  if (!message || message.senderId.toString() !== userId.toString()) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.type !== 'voice') {
    throw new ApiError(400, 'Only voice messages have a transcript');
  }
  if (message.deletedAt) {
    throw new ApiError(409, 'Cannot edit a deleted message');
  }

  message.transcript = transcript;
  message.transcriptEdited = true;
  await message.save();

  return message;
};

export const softDeleteMessage = async ({ userId, messageId }) => {
  const message = await Message.findById(messageId);
  if (!message || message.senderId.toString() !== userId.toString()) {
    throw new ApiError(404, 'Message not found');
  }
  if (!withinEditWindow(message)) {
    throw new ApiError(403, 'Delete window has expired');
  }

  message.deletedAt = new Date();
  await message.save();

  return message;
};

export { TEXT_MESSAGE_TYPES, ALL_MESSAGE_TYPES };

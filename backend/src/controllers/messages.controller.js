import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { isBlockedPair } from '../services/privacy.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { headObject } from '../services/storage.js';
import { ALLOWED_MIME_TYPES, MAX_MEDIA_SIZE_BYTES, MEDIA_MESSAGE_TYPES } from '../utils/mediaTypes.js';

const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

const TEXT_MESSAGE_TYPES = ['text', 'emoji'];
const ALL_MESSAGE_TYPES = [...TEXT_MESSAGE_TYPES, ...MEDIA_MESSAGE_TYPES];

const assertParticipant = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.participants.some((id) => id.toString() === userId)) {
    throw new ApiError(404, 'Chat not found');
  }
  return chat;
};

const withinEditWindow = (message) => Date.now() - message.createdAt.getTime() <= EDIT_DELETE_WINDOW_MS;

// Verifies the uploaded object actually belongs to the sender and actually matches what it
// claims to be — never trust the client's declared mimeType/size alone (supabase-upload-skill).
const validateMediaUpload = async (userId, type, objectKey) => {
  if (!objectKey.startsWith(`${userId}/`)) {
    throw new ApiError(403, 'Cannot attach media you did not upload');
  }

  let actual;
  try {
    actual = await headObject(objectKey);
  } catch {
    throw new ApiError(400, 'Uploaded object not found — upload it before attaching to a message');
  }

  const allowedExtensionsByMime = ALLOWED_MIME_TYPES[type];
  if (!allowedExtensionsByMime[actual.mimeType]) {
    throw new ApiError(400, `Uploaded object's mime type "${actual.mimeType}" is not allowed for ${type}`);
  }
  if (actual.size > MAX_MEDIA_SIZE_BYTES[type]) {
    throw new ApiError(400, `Uploaded object exceeds the ${MAX_MEDIA_SIZE_BYTES[type]}-byte limit for ${type}`);
  }

  return actual;
};

export const listMessages = asyncHandler(async (req, res) => {
  await assertParticipant(req.params.id, req.user.id);

  const limit = Math.min(Number(req.query.limit) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const query = { chatId: req.params.id };
  if (req.query.cursor) {
    query._id = { $lt: req.query.cursor };
  }

  const messages = await Message.find(query).sort({ _id: -1 }).limit(limit);
  const nextCursor = messages.length === limit ? messages[messages.length - 1]._id : null;

  res.json({ messages: await Promise.all(messages.map(serializeMessage)), nextCursor });
});

export const createMessage = asyncHandler(async (req, res) => {
  const { chatId, type, content, objectKey, durationSeconds } = req.body;
  const chat = await assertParticipant(chatId, req.user.id);

  if (!chat.isGroup) {
    const otherId = chat.participants.find((id) => id.toString() !== req.user.id);
    const [me, other] = await Promise.all([User.findById(req.user.id), User.findById(otherId)]);
    if (isBlockedPair(me, other)) {
      throw new ApiError(403, 'Cannot message this user');
    }
  }

  const messageData = { chatId, senderId: req.user.id, type, content: content || '' };

  if (MEDIA_MESSAGE_TYPES.includes(type)) {
    const verified = await validateMediaUpload(req.user.id, type, objectKey);
    messageData.mediaUrl = objectKey;
    messageData.mediaMeta = {
      mimeType: verified.mimeType,
      size: verified.size,
      durationSeconds: type === 'voice' ? durationSeconds : undefined,
    };
  }

  const message = await Message.create(messageData);

  await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

  res.status(201).json({ message: await serializeMessage(message) });
});

export const editMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message || message.senderId.toString() !== req.user.id) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.deletedAt) {
    throw new ApiError(409, 'Cannot edit a deleted message');
  }
  if (!withinEditWindow(message)) {
    throw new ApiError(403, 'Edit window has expired');
  }

  message.content = req.body.content;
  message.editedAt = new Date();
  await message.save();

  res.json({ message: await serializeMessage(message) });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message || message.senderId.toString() !== req.user.id) {
    throw new ApiError(404, 'Message not found');
  }
  if (!withinEditWindow(message)) {
    throw new ApiError(403, 'Delete window has expired');
  }

  message.deletedAt = new Date();
  await message.save();

  res.status(204).send();
});

export { TEXT_MESSAGE_TYPES, ALL_MESSAGE_TYPES };

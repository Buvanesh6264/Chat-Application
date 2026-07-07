import { asyncHandler } from '../utils/asyncHandler.js';
import { Message } from '../models/Message.js';
import { Chat } from '../models/Chat.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { getParticipantChat } from '../services/chats.js';
import { emitToUser } from '../services/realtime.js';
import {
  sendMessage,
  editMessageContent,
  editTranscript,
  softDeleteMessage,
  TEXT_MESSAGE_TYPES,
  ALL_MESSAGE_TYPES,
} from '../services/messages.js';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export const listMessages = asyncHandler(async (req, res) => {
  await getParticipantChat(req.params.id, req.user.id);

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
  const { message } = await sendMessage({ senderId: req.user.id, chatId, type, content, objectKey, durationSeconds });

  res.status(201).json({ message: await serializeMessage(message) });
});

export const editMessage = asyncHandler(async (req, res) => {
  const message = await editMessageContent({ userId: req.user.id, messageId: req.params.id, content: req.body.content });
  res.json({ message: await serializeMessage(message) });
});

export const editMessageTranscript = asyncHandler(async (req, res) => {
  const message = await editTranscript({ userId: req.user.id, messageId: req.params.id, transcript: req.body.transcript });
  const serialized = await serializeMessage(message);

  // No socket-event equivalent for transcript edits in this pass (unlike content edit/delete,
  // which already have both a REST and socket entry point) — REST reaches into the realtime bus
  // directly so participants still see the correction live.
  const chat = await Chat.findById(message.chatId);
  for (const participantId of chat.participants) {
    emitToUser(participantId, 'message:edit', serialized);
  }

  res.json({ message: serialized });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  await softDeleteMessage({ userId: req.user.id, messageId: req.params.id });
  res.status(204).send();
});

export { TEXT_MESSAGE_TYPES, ALL_MESSAGE_TYPES };

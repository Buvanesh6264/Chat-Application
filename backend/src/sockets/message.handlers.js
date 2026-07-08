import { ApiError } from '../utils/ApiError.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Chat } from '../models/Chat.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { getParticipantChat } from '../services/chats.js';
import { sendMessage, editMessageContent, softDeleteMessage } from '../services/messages.js';
import { emitToUser } from '../services/realtime.js';

// Room-scoped only — never io.emit() to everyone. Rooms are per-user (`user:${id}`), not
// per-chat, so a brand-new chat's participants are already reachable without a room-join step.
const emitToParticipants = (io, participantIds, event, payload) => {
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit(event, payload);
  }
};

const ackError = (ack, err) => ack?.({ ok: false, error: err.message });

export const registerMessageHandlers = (io, socket) => {
  const userId = socket.data.userId;

  socket.on('message:send', async (payload, ack) => {
    try {
      const { message, chat } = await sendMessage({ senderId: userId, ...(payload || {}) });
      const serialized = await serializeMessage(message);
      // Includes the sender's own room so their other open tabs/devices see the same message.
      emitToParticipants(io, chat.participants, 'message:receive', serialized);
      ack?.({ ok: true, message: serialized });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('message:edit', async (payload, ack) => {
    try {
      const { messageId, content } = payload || {};
      const message = await editMessageContent({ userId, messageId, content });
      const chat = await getParticipantChat(message.chatId, userId);
      const serialized = await serializeMessage(message);
      emitToParticipants(io, chat.participants, 'message:edit', serialized);
      ack?.({ ok: true, message: serialized });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('message:delete', async (payload, ack) => {
    try {
      const { messageId } = payload || {};
      const message = await softDeleteMessage({ userId, messageId });
      const chat = await getParticipantChat(message.chatId, userId);
      const serialized = await serializeMessage(message);
      emitToParticipants(io, chat.participants, 'message:delete', serialized);
      ack?.({ ok: true, message: serialized });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('message:reaction', async (payload, ack) => {
    try {
      const { messageId, emoji } = payload || {};
      const message = await Message.findById(messageId);
      if (!message) {
        throw new ApiError(404, 'Message not found');
      }
      const chat = await getParticipantChat(message.chatId, userId);

      // Toggle: the same emoji from the same user again removes it, a different emoji replaces it.
      const alreadyReacted = message.reactions.find((r) => r.userId.toString() === userId.toString());
      message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId.toString());
      if (!alreadyReacted || alreadyReacted.emoji !== emoji) {
        message.reactions.push({ userId, emoji });
      }
      await message.save();

      const serialized = await serializeMessage(message);
      emitToParticipants(io, chat.participants, 'message:reaction', serialized);
      ack?.({ ok: true, message: serialized });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('message:read', async (payload, ack) => {
    try {
      const { chatId, upToMessageId } = payload || {};
      if (!chatId) {
        throw new ApiError(400, 'chatId is required');
      }
      const chat = await getParticipantChat(chatId, userId);

      // Clearing your own unread badge is orthogonal to whether you broadcast read receipts to
      // others — must happen even when readReceiptsEnabled is off, so this runs before that check.
      await Chat.updateOne(
        { _id: chatId, 'unreadCounts.userId': userId },
        { $set: { 'unreadCounts.$.count': 0 } }
      );
      emitToUser(userId, 'chat:unreadUpdate', { chatId, count: 0 });

      const reader = await User.findById(userId).select('readReceiptsEnabled');
      if (!reader.readReceiptsEnabled) {
        // "they don't emit" — the read is not recorded or broadcast at all while disabled.
        return ack?.({ ok: true, suppressed: true });
      }

      const query = { chatId, senderId: { $ne: userId } };
      if (upToMessageId) {
        query._id = { $lte: upToMessageId };
      }
      await Message.updateMany(query, { $pull: { readBy: { userId } } });
      await Message.updateMany(query, { $push: { readBy: { userId, readAt: new Date() } } });

      const otherParticipantIds = chat.participants.filter((id) => id.toString() !== userId.toString());
      const otherUsers = await User.find({ _id: { $in: otherParticipantIds } }).select('readReceiptsEnabled');
      // "they don't receive" — a participant who has receipts disabled doesn't see anyone else's either.
      const recipientIds = otherUsers.filter((u) => u.readReceiptsEnabled).map((u) => u._id);

      emitToParticipants(io, recipientIds, 'message:read', { chatId, userId, upToMessageId });
      ack?.({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });
};

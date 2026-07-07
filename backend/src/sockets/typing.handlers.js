import { getParticipantChat } from '../services/chats.js';

const relayTyping = (io, socket, event) => async (payload) => {
  const { chatId } = payload || {};
  if (!chatId) return;

  try {
    const chat = await getParticipantChat(chatId, socket.data.userId);
    const otherParticipantIds = chat.participants.filter((id) => id.toString() !== socket.data.userId.toString());
    for (const participantId of otherParticipantIds) {
      io.to(`user:${participantId}`).emit(event, { chatId, userId: socket.data.userId });
    }
  } catch {
    // Not a participant (or chat doesn't exist) — silently drop, typing indicators aren't
    // worth an ack/error round-trip.
  }
};

export const registerTypingHandlers = (io, socket) => {
  socket.on('typing:start', relayTyping(io, socket, 'typing:start'));
  socket.on('typing:stop', relayTyping(io, socket, 'typing:stop'));
};

import { ApiError } from '../utils/ApiError.js';
import { Chat } from '../models/Chat.js';

// Shared by REST message routes and the socket message/typing handlers — both must derive
// authorization the same way, never trusting a client-supplied participant claim.
export const getParticipantChat = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.participants.some((id) => id.toString() === userId.toString())) {
    throw new ApiError(404, 'Chat not found');
  }
  return chat;
};

import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { createDownloadUrl } from './storage.js';
import { transcribeAudio } from './groq.js';
import { emitToUser } from './realtime.js';

// Orchestrates one voice message's transcription: fetch a fresh presigned URL (the bucket is
// private), call Groq, persist, then push the result live. Errors propagate to the caller —
// this function doesn't decide fire-and-forget vs. awaited, its callers do.
//
// Takes a messageId, not a live Mongoose document — sendMessage's caller (REST controller/socket
// handler) reads the *same* in-memory object it hands off here for its own immediate response.
// If this mutated and saved that shared object directly, the fire-and-forget mutation could win
// a race against the caller's read and silently show a transcript in what's supposed to be an
// immediate, still-null response — a real bug only hidden in production by Groq's network
// latency. Re-fetching gives this function its own independent document instance.
export const transcribeVoiceMessage = async (messageId) => {
  const message = await Message.findById(messageId);

  const audioUrl = await createDownloadUrl(message.mediaUrl);
  const transcript = await transcribeAudio(audioUrl);

  message.transcript = transcript;
  await message.save();

  const chat = await Chat.findById(message.chatId);
  const serialized = await serializeMessage(message);
  for (const participantId of chat.participants) {
    emitToUser(participantId, 'message:transcript-ready', serialized);
  }

  return message;
};

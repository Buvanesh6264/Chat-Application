import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'emoji', 'photo', 'voice', 'pdf'], required: true },
    content: { type: String, default: '' }, // text/emoji content, or a media caption
    mediaUrl: { type: String, default: null },
    mediaMeta: {
      mimeType: { type: String, default: null },
      size: { type: Number, default: null },
      durationSeconds: { type: Number, default: null }, // voice notes only
    },
    transcript: { type: String, default: null }, // voice notes; arrives async post-send
    transcriptEdited: { type: Boolean, default: false },
    translatedContent: [
      {
        _id: false,
        language: { type: String, required: true },
        text: { type: String, required: true },
      },
    ], // populated on-demand per recipient request, cached via services/translationCache.js
    readBy: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        readAt: { type: Date, required: true },
      },
    ],
    reactions: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true },
      },
    ],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ chatId: 1, createdAt: -1 });

export const Message = model('Message', messageSchema);

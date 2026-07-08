import { Schema, model } from 'mongoose';

const chatSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: null }, // group chats only
    groupAvatarUrl: { type: String, default: null }, // group chats only
    groupAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }], // group chats only, subset of participants
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    // Per-participant unread counter — incremented for everyone but the sender on every send
    // (services/messages.js#sendMessage), reset to 0 for a user on message:read.
    unreadCounts: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        count: { type: Number, default: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });

export const Chat = model('Chat', chatSchema);

import { Schema, model } from 'mongoose';

const chatSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: null }, // group chats only
    groupAvatarUrl: { type: String, default: null }, // group chats only
    groupAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }], // group chats only, subset of participants
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });

export const Chat = model('Chat', chatSchema);

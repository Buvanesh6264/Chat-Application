import { Schema, model } from 'mongoose';

const storySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediaUrl: { type: String, required: true },
    caption: { type: String, default: '' },
    viewedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL — auto-deletes at this timestamp
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Story = model('Story', storySchema);

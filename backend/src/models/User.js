import { Schema, model } from 'mongoose';

const VISIBILITY_ENUM = ['Everyone', 'Friends', 'Nobody'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, index: true }, // E.164, normalized before save
    passwordHash: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, select: false }, // hashed at rest, rotated on each use
    profileImageUrl: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 500 },
    privacySettings: {
      profileVisibility: { type: String, enum: VISIBILITY_ENUM, default: 'Everyone' },
      lastSeenVisibility: { type: String, enum: VISIBILITY_ENUM, default: 'Everyone' },
      onlineStatusVisibility: { type: String, enum: VISIBILITY_ENUM, default: 'Everyone' },
    },
    readReceiptsEnabled: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const User = model('User', userSchema);

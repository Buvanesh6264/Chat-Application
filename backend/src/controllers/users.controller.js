import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { isBlockedPair, canViewField } from '../services/privacy.js';
import { createDownloadUrl } from '../services/storage.js';
import { validateMediaUpload } from '../services/mediaValidation.js';

const SEARCH_RESULT_LIMIT = 20;

export const searchUsers = asyncHandler(async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    throw new ApiError(400, 'phone query param is required');
  }

  const me = await User.findById(req.user.id);

  const candidates = await User.find({
    _id: { $ne: req.user.id },
    phoneNumber: { $regex: phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
  })
    .limit(SEARCH_RESULT_LIMIT * 2) // over-fetch, then filter blocked pairs below
    .select('name phoneNumber profileImageUrl blockedUsers');

  const results = candidates
    .filter(
      (candidate) =>
        !me.blockedUsers.some((id) => id.equals(candidate._id)) &&
        !candidate.blockedUsers.some((id) => id.equals(me._id))
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((candidate) => ({
      id: candidate._id,
      name: candidate.name,
      phoneNumber: candidate.phoneNumber,
      profileImageUrl: candidate.profileImageUrl,
    }));

  res.json({ users: results });
});

export const getProfile = asyncHandler(async (req, res) => {
  const [viewer, target] = await Promise.all([
    User.findById(req.user.id),
    User.findById(req.params.id),
  ]);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  if (isBlockedPair(target, viewer)) {
    // A hard block hides existence entirely — unlike the visibility enums below, which gate
    // individual fields on an otherwise-visible user, this is intentionally all-or-nothing.
    throw new ApiError(404, 'User not found');
  }

  // profileVisibility, lastSeenVisibility, and onlineStatusVisibility are independent settings
  // (spec 4.2) — each field is gated on its own enum, never on another field's result.
  const canViewProfile = canViewField(viewer, target, 'profile');
  const canViewLastSeen = canViewField(viewer, target, 'lastSeen');
  const canViewOnlineStatus = canViewField(viewer, target, 'onlineStatus');

  res.json({
    user: {
      id: target._id,
      name: canViewProfile ? target.name : null,
      phoneNumber: canViewProfile ? target.phoneNumber : null,
      profileImageUrl:
        canViewProfile && target.profileImageUrl
          ? await createDownloadUrl(target.profileImageUrl)
          : null,
      bio: canViewProfile ? target.bio : null,
      lastSeenAt: canViewLastSeen ? target.lastSeenAt : null,
      isOnline: canViewOnlineStatus ? target.isOnline : null,
    },
  });
});

export const updatePrivacy = asyncHandler(async (req, res) => {
  const { profileVisibility, lastSeenVisibility, onlineStatusVisibility, readReceiptsEnabled } = req.body;

  const update = {};
  if (profileVisibility) update['privacySettings.profileVisibility'] = profileVisibility;
  if (lastSeenVisibility) update['privacySettings.lastSeenVisibility'] = lastSeenVisibility;
  if (onlineStatusVisibility) update['privacySettings.onlineStatusVisibility'] = onlineStatusVisibility;
  if (typeof readReceiptsEnabled === 'boolean') update.readReceiptsEnabled = readReceiptsEnabled;

  const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { returnDocument: 'after' });
  res.json({ privacySettings: user.privacySettings, readReceiptsEnabled: user.readReceiptsEnabled });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, profileImageUrl } = req.body;

  const update = {};
  if (name !== undefined) update.name = name;
  if (bio !== undefined) update.bio = bio;
  if (profileImageUrl !== undefined) {
    // profileImageUrl is a client-uploaded objectKey (see POST /media/upload-url), never a
    // client-supplied URL — re-verify it actually belongs to this user and matches the photo
    // allowlist before persisting a reference to it, same discipline as message/story media.
    if (profileImageUrl) {
      await validateMediaUpload(req.user.id, 'photo', profileImageUrl);
    }
    update.profileImageUrl = profileImageUrl;
  }

  const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { returnDocument: 'after' });
  res.json({
    user: {
      id: user._id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      profileImageUrl: user.profileImageUrl ? await createDownloadUrl(user.profileImageUrl) : null,
      bio: user.bio,
    },
  });
});

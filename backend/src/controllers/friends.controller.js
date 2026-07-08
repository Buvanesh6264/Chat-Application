import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { canViewField } from '../services/privacy.js';
import { emitToUser } from '../services/realtime.js';

const areBlocked = (a, b) =>
  a.blockedUsers.some((id) => id.equals(b._id)) || b.blockedUsers.some((id) => id.equals(a._id));

export const sendRequest = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (to === req.user.id) {
    throw new ApiError(400, 'Cannot send a friend request to yourself');
  }

  const [me, target] = await Promise.all([User.findById(req.user.id), User.findById(to)]);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  if (areBlocked(me, target)) {
    throw new ApiError(403, 'Cannot send a friend request to this user');
  }
  if (me.friends.some((id) => id.equals(target._id))) {
    throw new ApiError(409, 'Already friends');
  }

  const existing = await FriendRequest.findOne({
    $or: [
      { from: me._id, to: target._id },
      { from: target._id, to: me._id },
    ],
    status: { $in: ['pending', 'accepted'] },
  });
  if (existing) {
    throw new ApiError(409, 'A friend request already exists between these users');
  }

  let request = await FriendRequest.create({ from: me._id, to: target._id, status: 'pending' });
  request = await request.populate('from', 'name phoneNumber profileImageUrl');
  emitToUser(target._id, 'friend:request:new', { request });

  res.status(201).json({ request });
});

export const respondToRequest = asyncHandler(async (req, res) => {
  const { requestId, action } = req.body;

  const request = await FriendRequest.findById(requestId);
  if (!request || request.to.toString() !== req.user.id) {
    throw new ApiError(404, 'Friend request not found');
  }
  if (request.status !== 'pending') {
    throw new ApiError(409, 'Friend request is no longer pending');
  }

  if (action === 'accept') {
    await Promise.all([
      User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } }),
      User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } }),
    ]);
    request.status = 'accepted';
    await request.save();
  } else {
    await request.deleteOne();
  }

  res.json({ request: action === 'accept' ? request : null });
});

export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (userId === req.user.id) {
    throw new ApiError(400, 'Cannot block yourself');
  }

  const target = await User.findById(userId);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  await Promise.all([
    User.findByIdAndUpdate(req.user.id, {
      $addToSet: { blockedUsers: target._id },
      $pull: { friends: target._id },
    }),
    User.findByIdAndUpdate(target._id, { $pull: { friends: req.user.id } }),
  ]);

  const existing = await FriendRequest.findOne({
    $or: [
      { from: req.user.id, to: target._id },
      { from: target._id, to: req.user.id },
    ],
  });
  if (existing) {
    existing.status = 'blocked';
    await existing.save();
  } else {
    await FriendRequest.create({ from: req.user.id, to: target._id, status: 'blocked' });
  }

  res.status(204).send();
});

export const listFriends = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user.id).populate(
    'friends',
    'name phoneNumber profileImageUrl privacySettings isOnline lastSeenAt blockedUsers'
  );

  const friends = me.friends.map((friend) => ({
    id: friend._id,
    name: friend.name,
    phoneNumber: friend.phoneNumber,
    profileImageUrl: friend.profileImageUrl,
    isOnline: canViewField(me, friend, 'onlineStatus') ? friend.isOnline : null,
    lastSeenAt: canViewField(me, friend, 'lastSeen') ? friend.lastSeenAt : null,
  }));

  res.json({ friends });
});

export const listPendingRequests = asyncHandler(async (req, res) => {
  const requests = await FriendRequest.find({ to: req.user.id, status: 'pending' }).populate(
    'from',
    'name phoneNumber profileImageUrl'
  );
  res.json({ requests });
});

export const listSentRequests = asyncHandler(async (req, res) => {
  const requests = await FriendRequest.find({ from: req.user.id, status: 'pending' }).populate(
    'to',
    'name phoneNumber profileImageUrl'
  );
  res.json({ requests });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await FriendRequest.findById(requestId);
  if (!request || request.from.toString() !== req.user.id) {
    throw new ApiError(404, 'Friend request not found');
  }
  if (request.status !== 'pending') {
    throw new ApiError(409, 'Friend request is no longer pending');
  }

  await request.deleteOne();
  res.status(204).send();
});

export const removeFriend = asyncHandler(async (req, res) => {
  const { friendId } = req.params;

  const me = await User.findById(req.user.id);
  if (!me.friends.some((id) => id.equals(friendId))) {
    throw new ApiError(404, 'Not friends with this user');
  }

  await Promise.all([
    User.findByIdAndUpdate(req.user.id, { $pull: { friends: friendId } }),
    User.findByIdAndUpdate(friendId, { $pull: { friends: req.user.id } }),
    // Without this cleanup, sendRequest's dedup check (status: pending|accepted) would
    // permanently block this pair from ever becoming friends again after an unfriend.
    FriendRequest.deleteMany({
      status: 'accepted',
      $or: [
        { from: req.user.id, to: friendId },
        { from: friendId, to: req.user.id },
      ],
    }),
  ]);

  res.status(204).send();
});

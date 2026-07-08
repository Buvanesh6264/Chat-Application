import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { Chat } from '../models/Chat.js';
import { isBlockedPair, isFriend } from '../services/privacy.js';
import { serializeMessage } from '../utils/serializeMessage.js';

const PARTICIPANT_FIELDS = 'name phoneNumber profileImageUrl';

export const listChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ participants: req.user.id })
    .sort({ updatedAt: -1 })
    .populate('participants', PARTICIPANT_FIELDS)
    .populate('lastMessage');

  // lastMessage is a soft-deletable Message doc — mask it the same way GET /chats/:id/messages
  // does, so a deleted message's content never leaks through the chat list.
  const serialized = await Promise.all(
    chats.map(async (chat) => {
      const { unreadCounts, ...rest } = chat.toObject();
      // Collapse the per-participant array down to a single scalar for the caller — never leak
      // other participants' unread counts.
      const unreadCount = unreadCounts?.find((u) => u.userId.toString() === req.user.id)?.count ?? 0;
      return {
        ...rest,
        unreadCount,
        lastMessage: chat.lastMessage ? await serializeMessage(chat.lastMessage) : null,
      };
    })
  );

  res.json({ chats: serialized });
});

export const createDirectChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (userId === req.user.id) {
    throw new ApiError(400, 'Cannot start a chat with yourself');
  }

  const [me, target] = await Promise.all([User.findById(req.user.id), User.findById(userId)]);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  if (isBlockedPair(me, target)) {
    throw new ApiError(403, 'Cannot start a chat with this user');
  }

  let chat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [req.user.id, userId], $size: 2 },
  }).populate('participants', PARTICIPANT_FIELDS);

  if (!chat) {
    chat = await Chat.create({ participants: [req.user.id, userId], isGroup: false });
    chat = await chat.populate('participants', PARTICIPANT_FIELDS);
  }

  res.status(201).json({ chat });
});

export const createGroupChat = asyncHandler(async (req, res) => {
  const { groupName, participantIds } = req.body;

  const uniqueIds = [...new Set([req.user.id, ...participantIds])];
  const members = await User.find({ _id: { $in: uniqueIds } });
  if (members.length !== uniqueIds.length) {
    throw new ApiError(404, 'One or more users not found');
  }

  const me = members.find((u) => u._id.toString() === req.user.id);
  const others = members.filter((u) => u._id.toString() !== req.user.id);

  const blocked = others.some((u) => isBlockedPair(me, u));
  if (blocked) {
    throw new ApiError(403, 'Cannot add a blocked user to a group');
  }

  // Groups can only be created from the caller's own accepted friends — enforced here, not just
  // by hiding non-friends in the picker (spec section 2.2).
  const nonFriend = others.some((u) => !isFriend(me, u._id));
  if (nonFriend) {
    throw new ApiError(403, 'Group members must be friends of the creator');
  }

  let chat = await Chat.create({
    participants: uniqueIds,
    isGroup: true,
    groupName,
    groupAdmins: [req.user.id],
  });
  chat = await chat.populate('participants', PARTICIPANT_FIELDS);

  res.status(201).json({ chat });
});

export const pinChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user.id });
  if (!chat) {
    throw new ApiError(404, 'Chat not found');
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $addToSet: { pinnedChats: chat._id } },
    { returnDocument: 'after' }
  );
  res.json({ pinnedChats: user.pinnedChats });
});

export const unpinChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user.id });
  if (!chat) {
    throw new ApiError(404, 'Chat not found');
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { pinnedChats: req.params.id } },
    { returnDocument: 'after' }
  );
  res.json({ pinnedChats: user.pinnedChats });
});

export const addMember = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }
  // groupAdmins[0] is treated as "the leader" everywhere the product has a notion of one — see
  // backend/CLAUDE.md's Chat data model note. Only the leader may add members, and only from the
  // leader's own friends (spec section 2.3), not any participant's.
  const leaderId = chat.groupAdmins[0];
  if (!leaderId || leaderId.toString() !== req.user.id) {
    throw new ApiError(403, 'Only the group leader can add members');
  }

  const [leader, target] = await Promise.all([User.findById(leaderId), User.findById(userId)]);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  if (isBlockedPair(leader, target)) {
    throw new ApiError(403, 'Cannot add a blocked user to a group');
  }
  if (!isFriend(leader, target._id)) {
    throw new ApiError(403, 'New members must be friends of the group leader');
  }

  await Chat.findByIdAndUpdate(chat._id, { $addToSet: { participants: userId } });
  res.status(204).send();
});

export const removeMember = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const chat = await Chat.findById(id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }

  const isSelf = userId === req.user.id;
  const isAdmin = chat.groupAdmins.some((adminId) => adminId.toString() === req.user.id);
  if (!isSelf && !isAdmin) {
    throw new ApiError(403, 'Only group admins can remove other members');
  }

  await Chat.findByIdAndUpdate(id, {
    $pull: { participants: userId, groupAdmins: userId },
  });
  res.status(204).send();
});

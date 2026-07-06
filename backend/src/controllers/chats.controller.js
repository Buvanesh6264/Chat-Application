import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { Chat } from '../models/Chat.js';
import { isBlockedPair } from '../services/privacy.js';
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
    chats.map(async (chat) => ({
      ...chat.toObject(),
      lastMessage: chat.lastMessage ? await serializeMessage(chat.lastMessage) : null,
    }))
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
  const blocked = members.some((u) => u._id.toString() !== req.user.id && isBlockedPair(me, u));
  if (blocked) {
    throw new ApiError(403, 'Cannot add a blocked user to a group');
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

export const addMember = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }
  if (!chat.groupAdmins.some((id) => id.toString() === req.user.id)) {
    throw new ApiError(403, 'Only group admins can add members');
  }

  const target = await User.findById(userId);
  if (!target) {
    throw new ApiError(404, 'User not found');
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

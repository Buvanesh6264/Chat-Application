import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { Chat } from '../models/Chat.js';
import { isBlockedPair, isFriend } from '../services/privacy.js';
import { serializeMessage } from '../utils/serializeMessage.js';
import { createDownloadUrl } from '../services/storage.js';
import { validateMediaUpload } from '../services/mediaValidation.js';

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
        // groupAvatarUrl (like profileImageUrl) is a stored objectKey against a private bucket —
        // resolve it to a fresh presigned GET on every read, never return the raw key.
        groupAvatarUrl: chat.groupAvatarUrl ? await createDownloadUrl(chat.groupAvatarUrl) : null,
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
  // Leader-or-any-admin may add members now (previously leader-only) — see backend/CLAUDE.md's
  // Chat data model note on groupAdmins[0] being "the leader". The friend check runs against the
  // *acting* admin's own friends, not the leader's, so each admin can only add their own contacts.
  const isAdmin = chat.groupAdmins.some((adminId) => adminId.toString() === req.user.id);
  if (!isAdmin) {
    throw new ApiError(403, 'Only the group leader or an admin can add members');
  }

  const [actingAdmin, target] = await Promise.all([
    User.findById(req.user.id),
    User.findById(userId),
  ]);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  if (isBlockedPair(actingAdmin, target)) {
    throw new ApiError(403, 'Cannot add a blocked user to a group');
  }
  if (!isFriend(actingAdmin, target._id)) {
    throw new ApiError(403, 'New members must be friends of the admin adding them');
  }

  await Chat.findByIdAndUpdate(chat._id, { $addToSet: { participants: userId } });
  res.status(204).send();
});

export const updateGroupChat = asyncHandler(async (req, res) => {
  const { groupName, groupAvatarUrl } = req.body;
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }

  const isAdmin = chat.groupAdmins.some((adminId) => adminId.toString() === req.user.id);
  if (!isAdmin) {
    throw new ApiError(403, 'Only the group leader or an admin can edit this group');
  }

  const update = {};
  if (groupName !== undefined) update.groupName = groupName;
  if (groupAvatarUrl !== undefined) {
    if (groupAvatarUrl) {
      await validateMediaUpload(req.user.id, 'photo', groupAvatarUrl);
    }
    update.groupAvatarUrl = groupAvatarUrl;
  }

  const updated = await Chat.findByIdAndUpdate(chat._id, { $set: update }, { returnDocument: 'after' })
    .populate('participants', PARTICIPANT_FIELDS);

  res.json({
    chat: {
      ...updated.toObject(),
      groupAvatarUrl: updated.groupAvatarUrl ? await createDownloadUrl(updated.groupAvatarUrl) : null,
    },
  });
});

export const promoteAdmin = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const chat = await Chat.findById(id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }

  const leaderId = chat.groupAdmins[0];
  if (!leaderId || leaderId.toString() !== req.user.id) {
    throw new ApiError(403, 'Only the group leader can promote admins');
  }
  if (!chat.participants.some((p) => p.toString() === userId)) {
    throw new ApiError(400, 'User is not a member of this group');
  }

  // Append only — never reorder, so groupAdmins[0] always stays the original leader.
  await Chat.findByIdAndUpdate(id, { $addToSet: { groupAdmins: userId } });
  res.status(204).send();
});

export const demoteAdmin = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const chat = await Chat.findById(id);
  if (!chat || !chat.isGroup) {
    throw new ApiError(404, 'Group chat not found');
  }

  const leaderId = chat.groupAdmins[0];
  if (!leaderId || leaderId.toString() !== req.user.id) {
    throw new ApiError(403, 'Only the group leader can demote admins');
  }
  if (leaderId.toString() === userId) {
    throw new ApiError(403, 'Cannot demote the group leader');
  }
  if (!chat.groupAdmins.some((adminId) => adminId.toString() === userId)) {
    throw new ApiError(400, 'User is not an admin of this group');
  }

  await Chat.findByIdAndUpdate(id, { $pull: { groupAdmins: userId } });
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

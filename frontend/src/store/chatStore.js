import { create } from 'zustand';

// High-frequency chat state (messages, typing, presence) lives here rather than in Context, so
// components can subscribe via selectors instead of re-rendering on every unrelated update.
//
// Note: messagesByChatId[chatId] is assumed oldest-first (chronological, top-to-bottom display
// order). GET /chats/:id/messages returns newest-first (sort _id: -1); the page layer must reverse
// that page before calling setMessages/prependMessages so this assumption holds.
export const useChatStore = create((set) => ({
  chats: [],
  messagesByChatId: {},
  typingByChatId: {},
  presenceByUserId: {},
  pinnedChatIds: new Set(),

  setChats: (chats) => set({ chats: chats.map((c) => ({ ...c, id: c.id ?? c._id })) }),

  // Hydrated once from the logged-in user's `pinnedChats` (login/signup response or cached user),
  // then kept in sync locally by pinChat/unpinChat below on top of the server round-trip.
  setPinnedChatIds: (ids) => set({ pinnedChatIds: new Set((ids || []).map(String)) }),

  addPinnedChatId: (chatId) =>
    set((state) => ({ pinnedChatIds: new Set(state.pinnedChatIds).add(String(chatId)) })),

  removePinnedChatId: (chatId) =>
    set((state) => {
      const next = new Set(state.pinnedChatIds);
      next.delete(String(chatId));
      return { pinnedChatIds: next };
    }),

  // Reorders the chat list on a new message: bump the matching chat to the front with its
  // lastMessage/updatedAt updated. Leaves state untouched if the chat isn't loaded yet — that
  // case is refreshed via a GET /chats call in the page, not invented here.
  upsertChatOnMessage: (chatId, message) =>
    set((state) => {
      const index = state.chats.findIndex((c) => c.id === chatId);
      if (index === -1) return {};
      const updated = { ...state.chats[index], lastMessage: message, updatedAt: message.createdAt };
      const rest = [...state.chats];
      rest.splice(index, 1);
      return { chats: [updated, ...rest] };
    }),

  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChatId: { ...state.messagesByChatId, [chatId]: messages },
    })),

  // Merges an older cursor page in front of what's already loaded (scroll-up pagination).
  // olderPage is expected to already be oldest-first, matching the rest of the array.
  prependMessages: (chatId, olderPage) =>
    set((state) => ({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: [...olderPage, ...(state.messagesByChatId[chatId] || [])],
      },
    })),

  // Only called from the message:receive socket listener, never from setMessages/prependMessages
  // (REST history loads) — the __live marker lets MessageBubble animate genuinely live-arriving
  // messages without replaying an entrance animation for a bulk history/pagination mount.
  addMessage: (chatId, message) =>
    set((state) => {
      const list = state.messagesByChatId[chatId] || [];
      if (list.some((m) => m.id === message.id)) return {}; // already have it (pagination/socket overlap)
      return {
        messagesByChatId: { ...state.messagesByChatId, [chatId]: [...list, { ...message, __live: true }] },
      };
    }),

  // Find-by-id, splice-replace — covers message:edit/delete/reaction/transcript-ready, each of
  // which arrives as a full updated message.
  replaceMessage: (chatId, message) =>
    set((state) => {
      const list = state.messagesByChatId[chatId];
      if (!list) return {};
      const index = list.findIndex((m) => m.id === message.id);
      if (index === -1) return {};
      const updated = [...list];
      updated[index] = message;
      return { messagesByChatId: { ...state.messagesByChatId, [chatId]: updated } };
    }),

  // Marks every message at or before upToMessageId as read by userId. Since the array is
  // oldest-first, "at or before" means from the start of the array up to and including the
  // index of upToMessageId.
  applyReadReceipt: (chatId, userId, upToMessageId) =>
    set((state) => {
      const list = state.messagesByChatId[chatId];
      if (!list) return {};
      let cutoff = list.length - 1;
      if (upToMessageId) {
        cutoff = list.findIndex((m) => m.id === upToMessageId);
        if (cutoff === -1) return {}; // referenced message isn't loaded, nothing to update
      }
      const updated = list.map((m, i) => {
        if (i > cutoff) return m;
        if (m.readBy?.some((r) => r.userId === userId)) return m;
        return { ...m, readBy: [...(m.readBy || []), { userId, readAt: new Date().toISOString() }] };
      });
      return { messagesByChatId: { ...state.messagesByChatId, [chatId]: updated } };
    }),

  setTyping: (chatId, userId, isTyping) =>
    set((state) => {
      const current = new Set(state.typingByChatId[chatId] || []);
      isTyping ? current.add(userId) : current.delete(userId);
      return { typingByChatId: { ...state.typingByChatId, [chatId]: [...current] } };
    }),

  setPresence: (userId, presence) =>
    set((state) => ({
      presenceByUserId: { ...state.presenceByUserId, [userId]: presence },
    })),
}));

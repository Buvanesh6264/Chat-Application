import { create } from 'zustand';

// High-frequency chat state (messages, typing, presence) lives here rather than in Context, so
// components can subscribe via selectors instead of re-rendering on every unrelated update.
export const useChatStore = create((set) => ({
  messagesByChatId: {},
  typingByChatId: {},
  presenceByUserId: {},

  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChatId: { ...state.messagesByChatId, [chatId]: messages },
    })),

  addMessage: (chatId, message) =>
    set((state) => ({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: [...(state.messagesByChatId[chatId] || []), message],
      },
    })),

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

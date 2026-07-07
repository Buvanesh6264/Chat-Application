import { create } from 'zustand';

// Stories grouped by author, each group sorted newest-first (matches GET /stories/feed order).
export const useStoryStore = create((set) => ({
  storiesByUserId: {},

  setStories: (stories) =>
    set(() => {
      const storiesByUserId = {};
      for (const story of stories) {
        storiesByUserId[story.userId] = [...(storiesByUserId[story.userId] || []), story];
      }
      return { storiesByUserId };
    }),

  // Deduped by id: a story you post yourself arrives twice on your own tab — once from the
  // POST /stories response, once from the story:new socket echo (same pattern as messages).
  addStory: (story) =>
    set((state) => {
      const existing = state.storiesByUserId[story.userId] || [];
      if (existing.some((s) => s.id === story.id)) return {};
      return {
        storiesByUserId: { ...state.storiesByUserId, [story.userId]: [story, ...existing] },
      };
    }),

  markViewed: (storyId) =>
    set((state) => {
      const storiesByUserId = { ...state.storiesByUserId };
      for (const userId of Object.keys(storiesByUserId)) {
        const index = storiesByUserId[userId].findIndex((s) => s.id === storyId);
        if (index === -1) continue;
        const updated = [...storiesByUserId[userId]];
        updated[index] = { ...updated[index], viewedByMe: true };
        storiesByUserId[userId] = updated;
      }
      return { storiesByUserId };
    }),
}));

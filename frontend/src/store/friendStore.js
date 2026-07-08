import { create } from 'zustand';

// Pending-incoming-friend-request badge count — seeded once from GET /friends/requests's array
// length (ChatLayout.jsx, on mount), then kept live via the friend:request:new socket event and
// decremented as FriendRequestsPanel resolves each request.
export const useFriendStore = create((set) => ({
  pendingRequestCount: 0,
  setPendingRequestCount: (count) => set({ pendingRequestCount: count }),
  incrementPendingRequestCount: () =>
    set((state) => ({ pendingRequestCount: state.pendingRequestCount + 1 })),
  decrementPendingRequestCount: () =>
    set((state) => ({ pendingRequestCount: Math.max(0, state.pendingRequestCount - 1) })),
}));

import { create } from 'zustand';

const THEME_STORAGE_KEY = 'chatapp:theme';

const getInitialTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useUiStore = create((set, get) => ({
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Only one profile can be viewed at a time, so a single scalar (not a per-modal map) is enough —
  // stashed alongside activeModal rather than passed as a component prop since ChatHeader opens
  // this modal but UserProfileModal is rendered as a sibling, not a child, of the trigger.
  profileModalUserId: null,
  openUserProfile: (userId) => set({ activeModal: 'user-profile', profileModalUserId: userId }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

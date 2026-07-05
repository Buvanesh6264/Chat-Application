import { create } from 'zustand';

export const useUiStore = create((set) => ({
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

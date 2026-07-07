import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';

export default function Modal({ id, title, children }) {
  const activeModal = useUiStore((s) => s.activeModal);

  if (activeModal !== id) return null;

  const close = () => useUiStore.getState().closeModal();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={close}
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-neutral-900">{title}</h2>
            <button type="button" onClick={close} aria-label="Close">
              <X className="h-5 w-5 text-neutral-500" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

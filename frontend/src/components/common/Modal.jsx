import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';

// Matches the CSS animation-out durations below (scale-out/fade-out) so the panel finishes its
// exit transition before actually unmounting, instead of vanishing mid-animation.
const EXIT_DURATION_MS = 120;

export default function Modal({ id, title, children, panelClassName = 'bg-elevated' }) {
  const isActive = useUiStore((s) => s.activeModal === id);
  const [rendered, setRendered] = useState(isActive);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isActive) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }
    if (!rendered) return undefined;

    setClosing(true);
    const timer = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isActive, rendered]);

  if (!rendered) return null;

  const close = () => useUiStore.getState().closeModal();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={close}
    >
      <div
        className={`mx-4 w-full max-w-md rounded-lg ${panelClassName} p-6 shadow-xl ${closing ? 'animate-scale-out' : 'animate-scale-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">{title}</h2>
            <button type="button" onClick={close} aria-label="Close" className="icon-btn">
              <X className="h-5 w-5 text-neutral-500 dark:text-ink-muted" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

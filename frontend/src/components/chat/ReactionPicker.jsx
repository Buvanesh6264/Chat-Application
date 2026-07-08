import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MARGIN = 8;

// Renders via a portal to document.body so it can never be clipped by MessageList's
// overflow-y-auto scroll container (which must stay overflow-y-auto for scroll-to-bottom/
// pagination logic — see MessageList.jsx). Positioned from the anchor's own bounding rect,
// flipping above the anchor when there isn't room below.
export default function ReactionPicker({ anchorRef, onSelect, onClose }) {
  const menuRef = useRef(null);
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let top = anchorRect.bottom + MARGIN;
    if (top + menuRect.height > window.innerHeight - MARGIN) {
      top = anchorRect.top - menuRect.height - MARGIN;
    }
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - menuRect.height - MARGIN));

    const left = Math.max(MARGIN, Math.min(anchorRect.left, window.innerWidth - menuRect.width - MARGIN));

    setStyle({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    // scroll events don't bubble, but a capture-phase listener on window still fires for
    // scroll on any nested scrollable ancestor — simpler than repositioning during scroll.
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 flex gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 shadow-lg dark:border-neutral-500/30 dark:bg-elevated"
        style={style ?? { top: -9999, left: -9999 }}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-lg transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}

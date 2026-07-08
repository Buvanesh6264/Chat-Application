import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getMessages } from '../../services/api.js';
import MessageBubble from './MessageBubble.jsx';

const NEAR_BOTTOM_THRESHOLD = 100;
const NEAR_TOP_THRESHOLD = 100;

export default function MessageList({ chatId, chat, nextCursor, setNextCursor }) {
  const { user } = useAuth();
  const messages = useChatStore((s) => s.messagesByChatId[chatId]);
  const containerRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const isInitialLoadRef = useRef(true);

  // Force scroll-to-bottom on chat switch / initial load for this chatId.
  useEffect(() => {
    isInitialLoadRef.current = true;
    prevMessageCountRef.current = 0;
  }, [chatId]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !messages) return;

    // Restore scroll position after an upward (prepend) page load.
    if (prevScrollHeightRef.current != null) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
      prevMessageCountRef.current = messages.length;
      return;
    }

    const grew = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isInitialLoadRef.current) {
      el.scrollTop = el.scrollHeight;
      isInitialLoadRef.current = false;
      return;
    }

    if (grew) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < NEAR_BOTTOM_THRESHOLD) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages]);

  const handleScroll = async () => {
    const el = containerRef.current;
    if (!el || loadingMore || !nextCursor) return;
    if (el.scrollTop > NEAR_TOP_THRESHOLD) return;

    setLoadingMore(true);
    prevScrollHeightRef.current = el.scrollHeight;
    try {
      const { messages: page, nextCursor: newCursor } = await getMessages(chatId, { cursor: nextCursor });
      const oldestFirst = [...page].reverse();
      useChatStore.getState().prependMessages(chatId, oldestFirst);
      setNextCursor(newCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!messages) {
    return <div className="min-h-0 flex-1" />;
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto py-2">
      {loadingMore && <div className="py-2 text-center text-xs text-neutral-500 dark:text-ink-muted">Loading…</div>}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} chat={chat} isOwn={message.senderId === user.id} />
      ))}
    </div>
  );
}

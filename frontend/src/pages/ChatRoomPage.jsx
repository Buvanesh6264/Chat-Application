import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ChatHeader from '../components/chat/ChatHeader.jsx';
import MessageList from '../components/chat/MessageList.jsx';
import MessageComposer from '../components/chat/MessageComposer.jsx';
import TypingIndicator from '../components/chat/TypingIndicator.jsx';
import { useChatStore } from '../store/chatStore.js';
import { useAuth } from '../hooks/useAuth.js';
import { getChats, getMessages, getUserProfile } from '../services/api.js';
import { getSocket } from '../services/socket.js';

export default function ChatRoomPage() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const chats = useChatStore((s) => s.chats);
  const typingUserIds = useChatStore((s) => s.typingByChatId[chatId]);
  const [nextCursor, setNextCursor] = useState(null);
  const [chatLoaded, setChatLoaded] = useState(false);

  const chat = chats.find((c) => c.id === chatId);

  // Fallback: chat not in the already-loaded list (direct URL navigation) — refetch once.
  useEffect(() => {
    if (chat) {
      setChatLoaded(true);
      return;
    }
    getChats().then((fetched) => {
      useChatStore.getState().setChats(fetched);
      setChatLoaded(true);
    });
  }, [chat, chatId]);

  useEffect(() => {
    let cancelled = false;

    getMessages(chatId).then(({ messages, nextCursor: cursor }) => {
      if (cancelled) return;
      const oldestFirst = [...messages].reverse();
      useChatStore.getState().setMessages(chatId, oldestFirst);
      setNextCursor(cursor);
      getSocket()?.emit('message:read', { chatId }, () => {});
    });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chat || chat.isGroup) return;
    const otherParticipant = chat.participants?.find((p) => p._id !== user.id);
    if (!otherParticipant) return;

    getUserProfile(otherParticipant._id)
      .then((profile) => {
        useChatStore.getState().setPresence(otherParticipant._id, {
          userId: otherParticipant._id,
          isOnline: profile.isOnline,
          lastSeenAt: profile.lastSeenAt,
        });
      })
      .catch(() => {}); // blocked pair 404s — presence just stays unseeded
  }, [chat, user.id]);

  if (!chatLoaded) return null;
  if (!chat) {
    return <div className="p-4 text-sm text-neutral-500 dark:text-ink-muted">Chat not found</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col animate-slide-in-right lg:animate-none">
      <ChatHeader chat={chat} />
      <MessageList chatId={chatId} chat={chat} nextCursor={nextCursor} setNextCursor={setNextCursor} />
      <TypingIndicator chat={chat} typingUserIds={typingUserIds} />
      <MessageComposer chatId={chatId} />
    </div>
  );
}

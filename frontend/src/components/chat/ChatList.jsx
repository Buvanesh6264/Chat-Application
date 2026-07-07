import { MessageCirclePlus } from 'lucide-react';
import { useChatStore } from '../../store/chatStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import ChatListItem from './ChatListItem.jsx';

const matchesQuery = (chat, userId, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (chat.isGroup) return chat.groupName?.toLowerCase().includes(q) ?? false;
  const other = chat.participants?.find((p) => p._id !== userId);
  return (
    other?.name?.toLowerCase().includes(q) || other?.phoneNumber?.toLowerCase().includes(q) || false
  );
};

export default function ChatList({ query = '' }) {
  const chats = useChatStore((s) => s.chats);
  const pinnedChatIds = useChatStore((s) => s.pinnedChatIds);
  const { user } = useAuth();

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <MessageCirclePlus className="h-10 w-10 text-primary-300" />
        <p className="text-sm text-ink-muted">No chats yet — search for someone to start messaging.</p>
        <button
          type="button"
          onClick={() => useUiStore.getState().openModal('new-chat')}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          Start a new chat
        </button>
      </div>
    );
  }

  const filtered = chats.filter((chat) => matchesQuery(chat, user.id, query));
  const pinned = filtered.filter((chat) => pinnedChatIds.has(String(chat.id)));
  const recent = filtered.filter((chat) => !pinnedChatIds.has(String(chat.id)));

  if (filtered.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-ink-muted">No chats match "{query}"</div>;
  }

  const renderGroup = (list, offset = 0) =>
    list.map((chat, i) => (
      <div
        key={chat.id}
        className="animate-fade-in-up"
        style={{ animationDelay: `${Math.min(i + offset, 8) * 40}ms` }}
      >
        <ChatListItem chat={chat} isPinned={pinnedChatIds.has(String(chat.id))} />
      </div>
    ));

  return (
    <div>
      {pinned.length > 0 && (
        <div className="border-b border-neutral-200">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Pinned
          </div>
          <div className="divide-y divide-neutral-200">{renderGroup(pinned)}</div>
        </div>
      )}
      <div className="divide-y divide-neutral-200">{renderGroup(recent, pinned.length)}</div>
    </div>
  );
}

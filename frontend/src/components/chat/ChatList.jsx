import { useChatStore } from '../../store/chatStore.js';
import ChatListItem from './ChatListItem.jsx';

export default function ChatList() {
  const chats = useChatStore((s) => s.chats);

  if (chats.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-neutral-500">No chats yet</div>;
  }

  return (
    <div className="divide-y divide-neutral-200">
      {chats.map((chat, i) => (
        <div
          key={chat.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <ChatListItem chat={chat} />
        </div>
      ))}
    </div>
  );
}

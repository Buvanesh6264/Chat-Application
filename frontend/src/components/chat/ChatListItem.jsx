import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Check, CheckCheck, MoreVertical, Pin, PinOff } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useChatStore } from '../../store/chatStore.js';
import { pinChat, unpinChat } from '../../services/api.js';

const mediaPreview = (message) => {
  if (message.deletedAt) return 'This message was deleted';
  if (message.type === 'photo') return 'Photo';
  if (message.type === 'voice') return 'Voice message';
  if (message.type === 'pdf') return 'PDF';
  return message.content || '';
};

export default function ChatListItem({ chat, isPinned }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const otherParticipant = chat.isGroup
    ? null
    : chat.participants?.find((p) => p._id !== user.id);

  const name = chat.isGroup ? chat.groupName : otherParticipant?.name;
  const avatarSrc = chat.isGroup ? chat.groupAvatarUrl : otherParticipant?.profileImageUrl;
  const presence = useChatStore((s) =>
    otherParticipant ? s.presenceByUserId[otherParticipant._id] : undefined
  );

  const unread =
    chat.lastMessage &&
    chat.lastMessage.senderId !== user.id &&
    !chat.lastMessage.readBy?.some((r) => r.userId === user.id);

  const isOwnLastMessage = chat.lastMessage && chat.lastMessage.senderId === user.id;
  const readByOther = chat.lastMessage?.readBy?.some((r) => r.userId !== user.id);

  const togglePin = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const { addPinnedChatId, removePinnedChatId } = useChatStore.getState();
    try {
      if (isPinned) {
        removePinnedChatId(chat.id);
        await unpinChat(chat.id);
      } else {
        addPinnedChatId(chat.id);
        await pinChat(chat.id);
      }
    } catch {
      // revert the optimistic update on failure
      if (isPinned) addPinnedChatId(chat.id);
      else removePinnedChatId(chat.id);
      toast.error('Failed to update pinned chats');
    }
  };

  return (
    <div
      className="group relative flex w-full items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-neutral-50"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      <button
        type="button"
        onClick={() => navigate(`/chats/${chat.id}`)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <Avatar
          src={avatarSrc}
          name={name}
          size="md"
          online={chat.isGroup ? undefined : presence?.isOnline}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium text-ink">{name}</span>
            {chat.updatedAt && (
              <span className="ml-2 shrink-0 text-xs text-ink-muted">
                {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-sm text-ink-muted">
              {isOwnLastMessage &&
                chat.lastMessage &&
                (readByOther ? (
                  <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ))}
              <span className="truncate">{chat.lastMessage ? mediaPreview(chat.lastMessage) : ''}</span>
            </span>
            {unread && <span className="ml-2 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gradient-primary" />}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        aria-label="Chat options"
        className="icon-btn shrink-0 rounded-full p-1 text-ink-muted opacity-60 hover:bg-neutral-200 hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-10 right-3 z-20 w-40 rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg animate-scale-in dark:bg-elevated dark:border-neutral-500/30">
            <button
              type="button"
              onClick={togglePin}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {isPinned ? 'Unpin chat' : 'Pin chat'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const mediaPreview = (message) => {
  if (message.deletedAt) return 'This message was deleted';
  if (message.type === 'photo') return 'Photo';
  if (message.type === 'voice') return 'Voice message';
  if (message.type === 'pdf') return 'PDF';
  return message.content || '';
};

export default function ChatListItem({ chat }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const otherParticipant = chat.isGroup
    ? null
    : chat.participants?.find((p) => p._id !== user.id);

  const name = chat.isGroup ? chat.groupName : otherParticipant?.name;
  const avatarSrc = chat.isGroup ? chat.groupAvatarUrl : otherParticipant?.profileImageUrl;

  const unread =
    chat.lastMessage &&
    chat.lastMessage.senderId !== user.id &&
    !chat.lastMessage.readBy?.some((r) => r.userId === user.id);

  return (
    <button
      type="button"
      onClick={() => navigate(`/chats/${chat.id}`)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
    >
      <Avatar src={avatarSrc} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-neutral-900">{name}</span>
          {chat.updatedAt && (
            <span className="ml-2 shrink-0 text-xs text-neutral-500">
              {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-neutral-500">
            {chat.lastMessage ? mediaPreview(chat.lastMessage) : ''}
          </span>
          {unread && <span className="ml-2 h-2.5 w-2.5 shrink-0 rounded-full bg-unread" />}
        </div>
      </div>
    </button>
  );
}

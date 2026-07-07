import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../common/Avatar.jsx';
import { useChatStore } from '../../store/chatStore.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function ChatHeader({ chat }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const otherParticipant = chat.isGroup
    ? null
    : chat.participants?.find((p) => p._id !== user.id);

  const presence = useChatStore((s) =>
    otherParticipant ? s.presenceByUserId[otherParticipant._id] : undefined
  );

  const name = chat.isGroup ? chat.groupName : otherParticipant?.name;
  const avatarSrc = chat.isGroup ? chat.groupAvatarUrl : otherParticipant?.profileImageUrl;

  let presenceLine = null;
  if (!chat.isGroup && presence) {
    if (presence.isOnline === true) {
      presenceLine = 'Online';
    } else if (presence.lastSeenAt) {
      presenceLine = `Last seen ${formatDistanceToNow(new Date(presence.lastSeenAt), { addSuffix: true })}`;
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
      <button
        type="button"
        onClick={() => navigate('/chats')}
        aria-label="Back"
        className="icon-btn lg:hidden"
      >
        <ArrowLeft className="h-5 w-5 text-neutral-900" />
      </button>
      <Avatar src={avatarSrc} name={name} size="md" online={chat.isGroup ? undefined : presence?.isOnline} />
      <div>
        <div className="font-medium text-neutral-900">{name}</div>
        {presenceLine && <div className="text-xs text-neutral-500">{presenceLine}</div>}
      </div>
    </div>
  );
}

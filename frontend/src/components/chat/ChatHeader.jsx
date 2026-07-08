import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../common/Avatar.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import { useChatStore } from '../../store/chatStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function ChatHeader({ chat }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // groupAdmins[0] is treated as "the leader" everywhere the app needs one — see
  // backend/CLAUDE.md's Chat data model note. Only the leader sees this control; the real
  // enforcement is server-side (chats.controller.js#addMember), not this UI check.
  const isLeader = chat.isGroup && String(chat.groupAdmins?.[0]) === user.id;

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
    <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-500/30">
      <button
        type="button"
        onClick={() => navigate('/chats')}
        aria-label="Back"
        className="icon-btn lg:hidden"
      >
        <ArrowLeft className="h-5 w-5 text-ink" />
      </button>
      <Avatar src={avatarSrc} name={name} size="md" online={chat.isGroup ? undefined : presence?.isOnline} />
      <div className="flex-1">
        <div className="font-medium text-ink">{name}</div>
        {presenceLine && <div className="text-xs text-ink-muted">{presenceLine}</div>}
      </div>
      {isLeader && (
        <button
          type="button"
          onClick={() => useUiStore.getState().openModal('add-member')}
          aria-label="Add member"
          className="icon-btn"
        >
          <UserPlus className="h-5 w-5 text-ink-muted" />
        </button>
      )}
      {chat.isGroup && <AddMemberModal chat={chat} />}
    </div>
  );
}

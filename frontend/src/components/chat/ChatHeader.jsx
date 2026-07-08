import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../common/Avatar.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import GroupInfoModal from './GroupInfoModal.jsx';
import UserProfileModal from '../profile/UserProfileModal.jsx';
import { useChatStore } from '../../store/chatStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function ChatHeader({ chat }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // groupAdmins[0] is treated as "the leader" everywhere the app needs one — see
  // backend/CLAUDE.md's Chat data model note. Leader-or-admin now both see the add-member
  // control (previously leader-only); the real enforcement is server-side
  // (chats.controller.js#addMember), not this UI check.
  const isAdmin = chat.isGroup && (chat.groupAdmins || []).map(String).includes(user.id);

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
      <Avatar
        src={avatarSrc}
        name={name}
        size="md"
        online={chat.isGroup ? undefined : presence?.isOnline}
        onClick={
          otherParticipant
            ? () => useUiStore.getState().openUserProfile(otherParticipant._id)
            : undefined
        }
      />
      <div
        className={`flex-1 ${otherParticipant ? 'cursor-pointer' : ''}`}
        onClick={
          otherParticipant
            ? () => useUiStore.getState().openUserProfile(otherParticipant._id)
            : undefined
        }
      >
        <div className="font-medium text-ink">{name}</div>
        {presenceLine && <div className="text-xs text-ink-muted">{presenceLine}</div>}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => useUiStore.getState().openModal('add-member')}
          aria-label="Add member"
          className="icon-btn"
        >
          <UserPlus className="h-5 w-5 text-ink-muted" />
        </button>
      )}
      {chat.isGroup && (
        <button
          type="button"
          onClick={() => useUiStore.getState().openModal('group-info')}
          aria-label="Group info"
          className="icon-btn"
        >
          <Info className="h-5 w-5 text-ink-muted" />
        </button>
      )}
      {chat.isGroup && <AddMemberModal chat={chat} />}
      {chat.isGroup && <GroupInfoModal chat={chat} />}
      {!chat.isGroup && otherParticipant && (
        <UserProfileModal
          fallbackName={otherParticipant.name}
          fallbackAvatarUrl={otherParticipant.profileImageUrl}
        />
      )}
    </div>
  );
}

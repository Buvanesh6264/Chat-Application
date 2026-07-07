import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.js';
import { getChats, blockUser } from '../services/api.js';
import ProfileView from '../components/profile/ProfileView.jsx';
import PrivacySettingsForm from '../components/profile/PrivacySettingsForm.jsx';
import FriendRequestsPanel from '../components/profile/FriendRequestsPanel.jsx';
import UserSearch from '../components/profile/UserSearch.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';

// Populated participant sub-docs come straight off Chat.toObject() (chats.controller.js#listChats),
// which keeps Mongo's raw _id rather than the `id` field auth responses build manually.
const participantId = (participant) => participant._id || participant.id;

// There's no "list my friends" endpoint, so this derives a stand-in from chats the user is
// already part of — deliberately labeled "People you've chatted with," not "Friends."
function useChatContacts(selfId) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getChats()
      .then((chats) => {
        if (cancelled) return;
        const seen = new Map();
        for (const chat of chats) {
          for (const participant of chat.participants || []) {
            const id = participantId(participant);
            if (!id || id === selfId || seen.has(id)) continue;
            seen.set(id, participant);
          }
        }
        setContacts(Array.from(seen.values()));
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load chat contacts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selfId]);

  return { contacts, loading };
}

function ChatContactsPanel() {
  const { user } = useAuth();
  const { contacts, loading } = useChatContacts(user?.id);
  const [blockedIds, setBlockedIds] = useState(new Set());

  // Blocking is one-directional and permanent from this UI (no unblock endpoint exists),
  // so we require an explicit confirmation before firing it.
  const handleBlock = async (participant) => {
    const id = participantId(participant);
    const confirmed = window.confirm(
      `Block ${participant.name}? This cannot be undone from this app.`
    );
    if (!confirmed) return;

    try {
      await blockUser(id);
      setBlockedIds((prev) => new Set(prev).add(id));
      toast.success(`${participant.name} blocked`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to block user');
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-neutral-900">
        People you&apos;ve chatted with
      </h3>

      {loading && <Spinner size="sm" />}

      {!loading && contacts.length === 0 && (
        <p className="text-sm text-neutral-500">No chats yet</p>
      )}

      <ul className="flex flex-col gap-3">
        {contacts.map((participant, i) => {
          const id = participantId(participant);
          const blocked = blockedIds.has(id);
          return (
            <li
              key={id}
              className="flex animate-fade-in-up items-center gap-3"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Avatar size="md" src={participant.profileImageUrl} name={participant.name} />
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{participant.name}</p>
                <p className="text-xs text-neutral-500">{participant.phoneNumber}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                disabled={blocked}
                onClick={() => handleBlock(participant)}
              >
                {blocked ? 'Blocked' : 'Block'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-2xl animate-fade-in-up flex-col gap-6 p-6">
      <ProfileView />
      <PrivacySettingsForm />
      <FriendRequestsPanel />
      <UserSearch />
      <ChatContactsPanel />
    </div>
  );
}

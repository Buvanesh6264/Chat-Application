import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getFriends, blockUser } from '../services/api.js';
import ProfileView from '../components/profile/ProfileView.jsx';
import FriendRequestsPanel from '../components/profile/FriendRequestsPanel.jsx';
import UserSearch from '../components/profile/UserSearch.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';

function useFriends() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFriends()
      .then((result) => {
        if (!cancelled) setFriends(result);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load friends');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { friends, loading };
}

function FriendsPanel() {
  const { friends, loading } = useFriends();
  const [blockedIds, setBlockedIds] = useState(new Set());

  // Blocking is one-directional and permanent from this UI (no unblock endpoint exists),
  // so we require an explicit confirmation before firing it.
  const handleBlock = async (friend) => {
    const confirmed = window.confirm(`Block ${friend.name}? This cannot be undone from this app.`);
    if (!confirmed) return;

    try {
      await blockUser(friend.id);
      setBlockedIds((prev) => new Set(prev).add(friend.id));
      toast.success(`${friend.name} blocked`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to block user');
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:bg-elevated">
      <h3 className="mb-4 text-base font-semibold text-neutral-900 dark:text-ink">Friends</h3>

      {loading && <Spinner size="sm" />}

      {!loading && friends.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-ink-muted">No friends yet</p>
      )}

      <ul className="flex flex-col gap-3">
        {friends.map((friend, i) => {
          const blocked = blockedIds.has(friend.id);
          return (
            <li
              key={friend.id}
              className="flex animate-fade-in-up items-center gap-3"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Avatar size="md" src={friend.profileImageUrl} name={friend.name} online={friend.isOnline} />
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-ink">{friend.name}</p>
                <p className="text-xs text-neutral-500 dark:text-ink-muted">{friend.phoneNumber}</p>
              </div>
              <Button size="sm" variant="danger" disabled={blocked} onClick={() => handleBlock(friend)}>
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
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/chats', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl animate-fade-in-up flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleBack} aria-label="Back" className="icon-btn">
          <ArrowLeft className="h-5 w-5 text-ink" />
        </button>
        <h1 className="font-display text-xl font-semibold text-ink">Profile</h1>
      </div>
      <ProfileView />
      <FriendRequestsPanel />
      <UserSearch />
      <FriendsPanel />
    </div>
  );
}

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { getUserProfile, sendFriendRequest } from '../../services/api.js';

// Views someone else's profile from a 1:1 chat header — distinct from ProfileView.jsx, which is
// self-edit-only and doesn't apply here. Renders privacy-gated fields defensively for null: a
// non-friend contact (e.g. from phone search) legitimately has name/photo hidden per their
// privacy settings, but the Send Friend Request button must still work regardless.
export default function UserProfileModal({ fallbackName, fallbackAvatarUrl }) {
  const isOpen = useUiStore((s) => s.activeModal === 'user-profile');
  const userId = useUiStore((s) => s.profileModalUserId);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setProfile(null);
    setRequestSent(false);
    getUserProfile(userId)
      .then(setProfile)
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  const handleSendRequest = async () => {
    if (!profile) return;
    setSending(true);
    try {
      await sendFriendRequest(profile.id);
      setRequestSent(true);
      toast.success('Friend request sent');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send friend request');
    } finally {
      setSending(false);
    }
  };

  const relationship = requestSent ? 'request_sent' : profile?.relationship;
  const displayName = profile?.name ?? fallbackName;
  const displayAvatar = profile?.profileImageUrl ?? fallbackAvatarUrl;

  return (
    <Modal id="user-profile" title="Profile" panelClassName="bg-panel-detail">
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {!loading && profile && (
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar size="xl" src={displayAvatar} name={displayName} online={profile.isOnline} />
          <div className="text-center">
            <h2 className="font-display text-lg font-semibold text-ink">{displayName}</h2>
            {profile.phoneNumber && <p className="text-sm text-ink-muted">{profile.phoneNumber}</p>}
            {profile.bio && <p className="mt-1 text-sm text-ink-muted">{profile.bio}</p>}
            {profile.lastSeenAt && !profile.isOnline && (
              <p className="mt-1 text-xs text-ink-muted">
                Last seen {new Date(profile.lastSeenAt).toLocaleString()}
              </p>
            )}
          </div>

          {relationship === 'none' && (
            <Button variant="gradient" className="w-full" loading={sending} onClick={handleSendRequest}>
              Send Friend Request
            </Button>
          )}
          {relationship === 'request_sent' && (
            <Button variant="secondary" className="w-full" disabled>
              Request Sent
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

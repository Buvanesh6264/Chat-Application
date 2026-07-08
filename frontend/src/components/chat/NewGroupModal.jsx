import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { getFriends, createGroupChat, getChats } from '../../services/api.js';

// Deliberately not phone-search like NewChatModal — group members can only come from the
// caller's friends list (spec section 2), so non-friends are simply never in the data source
// here rather than being filtered client-side out of a broader search.
export default function NewGroupModal() {
  const navigate = useNavigate();
  const isOpen = useUiStore((s) => s.activeModal === 'new-group');
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getFriends()
      .then(setFriends)
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedIds.size === 0) return;
    setCreating(true);
    try {
      const chat = await createGroupChat(groupName.trim(), [...selectedIds]);
      const chatId = chat.id ?? chat._id;
      const refreshed = await getChats();
      useChatStore.getState().setChats(refreshed);
      navigate(`/chats/${chatId}`);
      useUiStore.getState().closeModal();
      setGroupName('');
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal id="new-group" title="New Group">
      <input
        autoFocus
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="Group name"
        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-ink focus:outline-none dark:border-neutral-500/30"
      />

      <div className="mt-3 max-h-64 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        )}
        {!loading && friends.length === 0 && (
          <div className="py-3 text-center text-sm text-ink-muted">
            Add some friends before starting a group.
          </div>
        )}
        {friends.map((friend) => {
          const selected = selectedIds.has(friend.id);
          return (
            <button
              key={friend.id}
              type="button"
              onClick={() => toggleSelected(friend.id)}
              className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <Avatar src={friend.profileImageUrl} name={friend.name} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{friend.name}</div>
                <div className="text-xs text-ink-muted">{friend.phoneNumber}</div>
              </div>
              {selected && <Check className="h-4 w-4 text-primary-500" />}
            </button>
          );
        })}
      </div>

      <Button
        variant="gradient"
        className="mt-3 w-full"
        disabled={!groupName.trim() || selectedIds.size === 0}
        loading={creating}
        onClick={handleCreate}
      >
        Create group ({selectedIds.size})
      </Button>
    </Modal>
  );
}

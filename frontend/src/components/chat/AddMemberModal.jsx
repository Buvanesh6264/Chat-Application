import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { getFriends, addChatMember, getChats } from '../../services/api.js';

// Leader-only control (ChatHeader.jsx hides the trigger for non-leaders) — the real enforcement
// is server-side (chats.controller.js#addMember), this is just the matching UI. Friends-only,
// same rationale as NewGroupModal: the picker's data source is the leader's friends list, not a
// broader search, so non-friends are never selectable rather than client-filtered.
export default function AddMemberModal({ chat }) {
  const isOpen = useUiStore((s) => s.activeModal === 'add-member');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [adding, setAdding] = useState(false);

  const existingIds = new Set((chat?.participants || []).map((p) => p._id));

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

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      await Promise.all([...selectedIds].map((id) => addChatMember(chat.id, id)));
      const refreshed = await getChats();
      useChatStore.getState().setChats(refreshed);
      toast.success('Members added');
      useUiStore.getState().closeModal();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  const candidates = friends.filter((f) => !existingIds.has(f.id));

  return (
    <Modal id="add-member" title="Add member">
      <div className="max-h-64 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        )}
        {!loading && candidates.length === 0 && (
          <div className="py-3 text-center text-sm text-ink-muted">
            No friends left to add — everyone's already in this group.
          </div>
        )}
        {candidates.map((friend) => {
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
        disabled={selectedIds.size === 0}
        loading={adding}
        onClick={handleAdd}
      >
        Add ({selectedIds.size})
      </Button>
    </Modal>
  );
}

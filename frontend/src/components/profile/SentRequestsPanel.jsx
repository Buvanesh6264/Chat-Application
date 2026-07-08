import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSentFriendRequests, cancelFriendRequest } from '../../services/api.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';

export default function SentRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  // Populated only after the network call already succeeded, to play a row's exit animation
  // before it's actually removed from `requests` — same pattern as FriendRequestsPanel.
  const [removingIds, setRemovingIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    getSentFriendRequests()
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load sent requests');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cancel = async (requestId) => {
    setCancellingId(requestId);
    try {
      await cancelFriendRequest(requestId);
      setRemovingIds((prev) => new Set(prev).add(requestId));
      setTimeout(() => {
        setRequests((prev) => prev.filter((r) => r._id !== requestId));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      }, 150);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-500/30 dark:bg-elevated">
      <h3 className="mb-4 text-base font-semibold text-ink">Sent requests</h3>

      {loading && <Spinner size="sm" />}

      {!loading && requests.length === 0 && (
        <p className="text-sm text-ink-muted">No pending sent requests</p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((request, i) => (
          <li
            key={request._id}
            className={`flex items-center gap-3 ${
              removingIds.has(request._id)
                ? 'animate-fade-out-down pointer-events-none'
                : 'animate-fade-in-up'
            }`}
            style={
              removingIds.has(request._id)
                ? undefined
                : { animationDelay: `${Math.min(i, 8) * 40}ms` }
            }
          >
            <Avatar size="md" src={request.to?.profileImageUrl} name={request.to?.name} />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{request.to?.name}</p>
              <p className="text-xs text-ink-muted">{request.to?.phoneNumber}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={cancellingId === request._id}
              loading={cancellingId === request._id}
              onClick={() => cancel(request._id)}
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

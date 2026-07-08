import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getFriendRequests, respondFriendRequest } from '../../services/api.js';
import { useFriendStore } from '../../store/friendStore.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';

// Only incoming pending requests exist here — there's no backend endpoint to list
// requests the current user has sent, so no "sent" tab is built.
export default function FriendRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks both which request and which action are in flight, so Accept/Reject don't
  // both show a spinner when only one was clicked.
  const [responding, setResponding] = useState({ id: null, action: null });
  // Populated only after the network call already succeeded, to play a row's exit animation
  // before it's actually removed from `requests` (separate step from `responding`). A Set, not a
  // single id — accepting/rejecting two rows within the same 150ms window must animate both out
  // independently rather than one clobbering the other.
  const [removingIds, setRemovingIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    getFriendRequests()
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load friend requests');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const respond = async (requestId, action) => {
    setResponding({ id: requestId, action });
    try {
      await respondFriendRequest(requestId, action);
      useFriendStore.getState().decrementPendingRequestCount();
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
      toast.error(err.response?.data?.error?.message || 'Failed to respond to request');
    } finally {
      setResponding({ id: null, action: null });
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-500/30 dark:bg-elevated">
      <h3 className="mb-4 text-base font-semibold text-ink">Friend requests</h3>

      {loading && <Spinner size="sm" />}

      {!loading && requests.length === 0 && (
        <p className="text-sm text-ink-muted">No pending requests</p>
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
            <Avatar
              size="md"
              src={request.from?.profileImageUrl}
              name={request.from?.name}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{request.from?.name}</p>
              <p className="text-xs text-ink-muted">{request.from?.phoneNumber}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={responding.id === request._id}
              loading={responding.id === request._id && responding.action === 'reject'}
              onClick={() => respond(request._id, 'reject')}
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={responding.id === request._id}
              loading={responding.id === request._id && responding.action === 'accept'}
              onClick={() => respond(request._id, 'accept')}
            >
              Accept
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

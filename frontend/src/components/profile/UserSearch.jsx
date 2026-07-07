import { useEffect, useRef, useState } from 'react';
import { searchUsers, sendFriendRequest } from '../../services/api.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';

const DEBOUNCE_MS = 300;

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // Per-result state, keyed by user id, so one row's send doesn't affect the others.
  const [rowState, setRowState] = useState({});
  const latestQuery = useRef('');

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      latestQuery.current = '';
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      latestQuery.current = trimmed;
      searchUsers(trimmed)
        .then((data) => {
          // Ignore a stale response if a newer query has since been fired.
          if (latestQuery.current !== trimmed) return;
          setResults(data);
        })
        .catch(() => {
          if (latestQuery.current !== trimmed) return;
          setResults([]);
        })
        .finally(() => {
          if (latestQuery.current === trimmed) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSend = async (userId) => {
    setRowState((prev) => ({ ...prev, [userId]: { status: 'sending' } }));
    try {
      await sendFriendRequest(userId);
      setRowState((prev) => ({ ...prev, [userId]: { status: 'sent' } }));
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Failed to send request';
      setRowState((prev) => ({ ...prev, [userId]: { status: 'error', message } }));
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-neutral-900">Find people</h3>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by phone number"
        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
      />

      {loading && (
        <div className="mt-3">
          <Spinner size="sm" />
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {results.map((result) => {
          const state = rowState[result.id] || { status: 'idle' };
          return (
            <li key={result.id} className="flex items-center gap-3">
              <Avatar size="md" src={result.profileImageUrl} name={result.name} />
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{result.name}</p>
                <p className="text-xs text-neutral-500">{result.phoneNumber}</p>
                {state.status === 'error' && (
                  <p className="text-xs text-danger">{state.message}</p>
                )}
              </div>
              <Button
                size="sm"
                disabled={state.status === 'sent'}
                loading={state.status === 'sending'}
                onClick={() => handleSend(result.id)}
              >
                {state.status === 'sent' ? 'Request sent' : 'Send Friend Request'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

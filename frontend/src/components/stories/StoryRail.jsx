import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStoryStore } from '../../store/storyStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getStoriesFeed, getUserProfile } from '../../services/api.js';
import { useUiStore } from '../../store/uiStore.js';
import Avatar from '../common/Avatar.jsx';
import StoryViewer from './StoryViewer.jsx';
import StoryComposer from './StoryComposer.jsx';

// Fully self-contained: fetches its own feed data and reads storyStore directly so it can be
// dropped into any page (ChatListPage, StoriesPage, ...) with zero setup from the caller.
export default function StoryRail() {
  const { user } = useAuth();
  const storiesByUserId = useStoryStore((s) => s.storiesByUserId);
  const [profiles, setProfiles] = useState({});
  const [viewingUserId, setViewingUserId] = useState(null);

  useEffect(() => {
    getStoriesFeed().then((stories) => useStoryStore.getState().setStories(stories));
  }, []);

  // Feed entries only carry a userId, no name — resolve display name/avatar per author. This is
  // bounded by "friends with an active story right now" (the feed is already friends-only and
  // stories expire in 24h), not the caller's whole friend list, so an unbounded-fanout parallel
  // fetch isn't a real risk here; still guarded so we never refetch an author we already have.
  useEffect(() => {
    if (!user) return;
    const missing = Object.keys(storiesByUserId).filter(
      (userId) => userId !== user.id && !profiles[userId]
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.allSettled(missing.map((userId) => getUserProfile(userId))).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') next[missing[i]] = result.value;
      });
      if (Object.keys(next).length > 0) setProfiles((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [storiesByUserId, user, profiles]);

  if (!user) return null;

  const myStories = storiesByUserId[user.id] || [];
  const hasOwnStory = myStories.length > 0;
  const otherUserIds = Object.keys(storiesByUserId).filter((userId) => userId !== user.id);

  return (
    <div className="flex gap-4 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <Avatar
            src={user.profileImageUrl}
            name={user.name}
            hasUnviewedStory={hasOwnStory ? myStories.some((s) => !s.viewedByMe) : undefined}
            onClick={
              hasOwnStory
                ? () => setViewingUserId(user.id)
                : () => useUiStore.getState().openModal('storyComposer')
            }
          />
          <button
            type="button"
            onClick={() => useUiStore.getState().openModal('storyComposer')}
            aria-label="Add story"
            className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white ring-2 ring-white"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <span className="max-w-16 truncate text-xs text-neutral-500">Your story</span>
      </div>

      {otherUserIds.map((userId) => {
        const group = storiesByUserId[userId];
        const hasUnviewed = group.some((s) => !s.viewedByMe);
        const profile = profiles[userId];
        return (
          <div key={userId} className="flex flex-col items-center gap-1">
            <Avatar
              src={profile?.profileImageUrl}
              name={profile?.name}
              hasUnviewedStory={hasUnviewed}
              onClick={() => setViewingUserId(userId)}
            />
            <span className="max-w-16 truncate text-xs text-neutral-900">
              {profile?.name || 'Story'}
            </span>
          </div>
        );
      })}

      {viewingUserId && (
        <StoryViewer userId={viewingUserId} onClose={() => setViewingUserId(null)} />
      )}

      <StoryComposer />
    </div>
  );
}

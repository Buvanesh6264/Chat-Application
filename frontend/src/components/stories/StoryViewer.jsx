import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStoryStore } from '../../store/storyStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { viewStory, getUserProfile } from '../../services/api.js';

// Full-viewport takeover, not the shared centered-dialog Modal — steps through one user's group
// of active stories at a time.
export default function StoryViewer({ userId, onClose }) {
  const { user } = useAuth();
  const rawGroup = useStoryStore((s) => s.storiesByUserId[userId]) || [];

  // Dedup by id: storyStore.addStory has no id guard, and the poster's own socket also receives
  // its own story:new broadcast (services/stories.js emits to `[...owner.friends, userId]`), so a
  // just-posted story can land twice in this array (REST-response addStory + socket-echo addStory)
  // on the same tab. The rail's ring is unaffected (grouped by userId, `.some()` over the array),
  // but this step-through would otherwise show/re-count the same story twice — dedup here only.
  const group = useMemo(() => {
    const seen = new Set();
    return rawGroup.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });
  }, [rawGroup]);

  const [index, setIndex] = useState(0);
  const [authorName, setAuthorName] = useState('');

  const isOwn = userId === user?.id;
  const current = group[index];

  useEffect(() => {
    if (isOwn) {
      setAuthorName('Your story');
    } else {
      getUserProfile(userId)
        .then((profile) => setAuthorName(profile.name))
        .catch(() => setAuthorName(''));
    }
  }, [userId, isOwn]);

  // Mark the currently-displayed story viewed. Calling this for your own story is a harmless
  // server-side no-op (services/stories.js#viewStory), so it's not special-cased away.
  // Depends on currentId (not `current`) deliberately — markViewed always returns a *new* story
  // object (no already-viewed guard in storyStore.js), so depending on `current` itself would
  // refire this effect on every markViewed call and loop forever.
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    viewStory(currentId)
      .then(() => useStoryStore.getState().markViewed(currentId))
      .catch(() => {});
  }, [currentId]);

  if (!current) return null;

  const goNext = () => {
    if (index < group.length - 1) setIndex((i) => i + 1);
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  // viewedBy is only present on the feed/post response for the story's own author — a simple
  // "seen by N" count is a reasonable scope-appropriate stand-in for resolving every viewer's name.
  const seenCount = isOwn && current.viewedBy ? current.viewedBy.length : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex gap-1 p-2">
        {group.map((story, i) => (
          <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className={`h-1 rounded-full bg-white transition-[width] duration-300 ease-linear ${i <= index ? 'w-full' : 'w-0'}`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 pb-2 text-white">
        <span className="text-sm font-medium">{authorName}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous story"
          className="absolute inset-y-0 left-0 w-1/2"
        />
        <div key={current.id} className="animate-fade-in flex h-full w-full items-center justify-center">
          <img
            src={current.mediaUrl}
            alt={current.caption || 'Story'}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next story"
          className="absolute inset-y-0 right-0 w-1/2"
        />
      </div>

      {current.caption && <p className="p-4 text-center text-sm text-white">{current.caption}</p>}

      {seenCount !== null && (
        <p className="pb-4 text-center text-xs text-white/70">
          Seen by {seenCount} {seenCount === 1 ? 'person' : 'people'}
        </p>
      )}
    </div>
  );
}

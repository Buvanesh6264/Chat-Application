import StoryRail from '../components/stories/StoryRail.jsx';

// Dedicated /stories route. StoryRail is self-contained (fetches its own feed data, owns the
// viewer/composer overlays) so this page is intentionally thin — the same component also sits
// atop the chat list in layouts/ChatLayout.jsx.
export default function StoriesPage() {
  return (
    <div className="animate-fade-in-up flex h-full flex-col bg-surface">
      <h1 className="px-4 pt-4 font-display text-lg font-semibold text-ink">Stories</h1>
      <StoryRail />
    </div>
  );
}

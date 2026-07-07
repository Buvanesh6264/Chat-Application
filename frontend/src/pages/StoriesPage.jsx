import StoryRail from '../components/stories/StoryRail.jsx';

// Dedicated /stories route. StoryRail is self-contained (fetches its own feed data, owns the
// viewer/composer overlays) so this page is intentionally thin — the same component also sits
// atop ChatListPage.
export default function StoriesPage() {
  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <h1 className="px-4 pt-4 text-lg font-semibold text-neutral-900">Stories</h1>
      <StoryRail />
    </div>
  );
}

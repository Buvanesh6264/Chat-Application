import { Search } from 'lucide-react';

export default function ChatSearchBar({ value, onChange }) {
  return (
    <div className="relative border-b border-neutral-200 px-4 py-2 dark:border-neutral-500/30">
      <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name or phone"
        className="w-full rounded-md border border-neutral-200 bg-transparent py-2 pl-9 pr-3 text-sm text-ink focus-ring-gradient focus:outline-none dark:border-neutral-500/30"
      />
    </div>
  );
}

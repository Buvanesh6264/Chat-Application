import { MessageCircle } from 'lucide-react';

export default function ChatPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <MessageCircle className="h-12 w-12 text-primary-300" />
      <p className="text-sm text-ink-muted">Select a chat to start messaging</p>
    </div>
  );
}

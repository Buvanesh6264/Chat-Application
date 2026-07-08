import { useState } from 'react';
import { Check, CheckCheck, MoreVertical, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../hooks/useAuth.js';
import { getSocket } from '../../services/socket.js';

const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const withinEditWindow = (message) =>
  Date.now() - new Date(message.createdAt).getTime() < EDIT_DELETE_WINDOW_MS;

const mediaPreviewText = (type) => {
  if (type === 'photo') return 'Photo';
  if (type === 'voice') return 'Voice message';
  if (type === 'pdf') return 'PDF';
  return '';
};

export default function MessageBubble({ message, chat, isOwn }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || '');
  const [wasLive] = useState(() => message.__live);

  const entranceClass = wasLive ? (isOwn ? 'animate-slide-in-right' : 'animate-slide-in-left') : '';

  // Group chats can have more than one sender, so unlike 1:1 chats a bubble needs to say who sent
  // it. Resolved client-side from the already-populated chat.participants rather than threading
  // sender name through serializeMessage on the backend (used consistently by many call sites).
  const senderName =
    chat?.isGroup && !isOwn
      ? chat.participants?.find((p) => p._id === message.senderId)?.name
      : null;

  const deleted = Boolean(message.deletedAt);
  const canEditDelete = isOwn && !deleted && withinEditWindow(message);
  const isRead = isOwn && (message.readBy || []).some((r) => r.userId !== user.id);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const socket = getSocket();
    socket?.emit('message:edit', { messageId: message.id, content: draft.trim() }, (res) => {
      if (res?.ok) setEditing(false);
    });
  };

  const handleDelete = () => {
    const socket = getSocket();
    socket?.emit('message:delete', { messageId: message.id }, () => {});
    setMenuOpen(false);
  };

  const handleReact = (emoji) => {
    const socket = getSocket();
    socket?.emit('message:reaction', { messageId: message.id, emoji }, () => {});
    setReactOpen(false);
    setMenuOpen(false);
  };

  const renderBody = () => {
    if (deleted) {
      // opacity, not a fixed color — inherits whichever text color the bubble (own/other, light/
      // dark) already set, just dimmed, so it stays legible against a solid violet own-bubble too.
      return <span className="italic opacity-70">This message was deleted</span>;
    }

    if (message.type === 'photo') {
      return (
        <div className="space-y-1">
          <img
            src={message.mediaUrl}
            alt={mediaPreviewText('photo')}
            className="max-w-56 cursor-pointer rounded-md"
            onClick={() => window.open(message.mediaUrl, '_blank')}
          />
          {message.content && <p className="text-sm">{message.content}</p>}
        </div>
      );
    }

    if (message.type === 'voice') {
      return (
        <div className="space-y-1">
          <audio controls src={message.mediaUrl} className="max-w-56" />
          {message.mediaMeta?.durationSeconds != null && (
            <div className="text-xs opacity-70">{message.mediaMeta.durationSeconds}s</div>
          )}
          {message.transcript && <p className="text-sm">{message.transcript}</p>}
        </div>
      );
    }

    if (message.type === 'pdf') {
      return (
        <button
          type="button"
          onClick={() => window.open(message.mediaUrl, '_blank')}
          className="flex items-center gap-2 text-sm text-primary-600 underline"
        >
          <FileText className="h-5 w-5" />
          Open PDF
        </button>
      );
    }

    return <p className="whitespace-pre-wrap text-sm">{message.content}</p>;
  };

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} px-4 py-1 ${entranceClass}`}>
      {senderName && <span className="mb-0.5 px-1 text-xs font-medium text-primary-600">{senderName}</span>}
      <div
        className={`group relative max-w-xs rounded-lg px-3 py-2 ${
          isOwn ? 'bg-bubble-own text-white' : 'bg-bubble-other text-neutral-900 dark:text-neutral-50'
        }`}
      >
        {editing ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-ink dark:border-neutral-500/30 dark:bg-elevated"
            />
            <button type="submit" className="text-xs underline">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs opacity-70">
              Cancel
            </button>
          </form>
        ) : (
          renderBody()
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="icon-btn absolute -top-2 right-1 hidden rounded-full bg-white p-0.5 shadow group-hover:block dark:bg-elevated"
          aria-label="Message actions"
        >
          <MoreVertical className="h-4 w-4 text-neutral-500 dark:text-ink-muted" />
        </button>

        {menuOpen && (
          <div className="absolute top-4 right-1 z-10 w-32 rounded-md border border-neutral-200 bg-white py-1 text-sm text-ink shadow-lg dark:border-neutral-500/30 dark:bg-elevated">
            {canEditDelete && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-1 text-left hover:bg-neutral-50 dark:hover:bg-surface"
              >
                Edit
              </button>
            )}
            {canEditDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full px-3 py-1 text-left text-danger hover:bg-neutral-50 dark:hover:bg-surface"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setReactOpen((v) => !v)}
              className="block w-full px-3 py-1 text-left hover:bg-neutral-50 dark:hover:bg-surface"
            >
              React
            </button>
            {reactOpen && (
              <div className="flex gap-1 px-2 py-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {message.reactions?.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {message.reactions.map((r) => (
            <button
              key={`${r.userId}-${r.emoji}`}
              type="button"
              onClick={() => handleReact(r.emoji)}
              className={`rounded-full border px-1.5 py-0.5 text-xs text-ink ${
                r.userId === user.id
                  ? 'border-primary-500 bg-accent-100 dark:bg-primary-500/20'
                  : 'border-neutral-200 bg-neutral-50 dark:border-neutral-500/30 dark:bg-elevated'
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500 dark:text-ink-muted">
        <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
        {message.editedAt && !deleted && <span>(edited)</span>}
        {isOwn && !deleted && (isRead ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
      </div>
    </div>
  );
}

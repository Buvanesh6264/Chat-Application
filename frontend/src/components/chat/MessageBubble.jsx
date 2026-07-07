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

export default function MessageBubble({ message, isOwn }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || '');

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
      return <span className="italic text-neutral-500">This message was deleted</span>;
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
            <div className="text-xs text-neutral-500">{message.mediaMeta.durationSeconds}s</div>
          )}
          {message.transcript && <p className="text-sm text-neutral-900">{message.transcript}</p>}
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
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} px-4 py-1`}>
      <div className={`group relative max-w-xs rounded-lg px-3 py-2 ${isOwn ? 'bg-accent-100' : 'bg-neutral-50'}`}>
        {editing ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded border border-neutral-200 px-2 py-1 text-sm"
            />
            <button type="submit" className="text-xs text-primary-600">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500">
              Cancel
            </button>
          </form>
        ) : (
          renderBody()
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="absolute -top-2 right-1 hidden rounded-full bg-white p-0.5 shadow group-hover:block"
          aria-label="Message actions"
        >
          <MoreVertical className="h-4 w-4 text-neutral-500" />
        </button>

        {menuOpen && (
          <div className="absolute top-4 right-1 z-10 w-32 rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg">
            {canEditDelete && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-1 text-left hover:bg-neutral-50"
              >
                Edit
              </button>
            )}
            {canEditDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full px-3 py-1 text-left text-danger hover:bg-neutral-50"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setReactOpen((v) => !v)}
              className="block w-full px-3 py-1 text-left hover:bg-neutral-50"
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
                    className="text-lg hover:scale-110"
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
              className={`rounded-full border px-1.5 py-0.5 text-xs ${
                r.userId === user.id ? 'border-primary-500 bg-accent-100' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
        <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
        {message.editedAt && !deleted && <span>(edited)</span>}
        {isOwn && !deleted && (isRead ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
      </div>
    </div>
  );
}

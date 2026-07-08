import { useEffect, useState } from 'react';
import { Outlet, useMatch, Link } from 'react-router-dom';
import { Plus, User, Settings, LogOut, Moon, Sun, MessageCircle, Users } from 'lucide-react';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import ChatList from '../components/chat/ChatList.jsx';
import ChatSearchBar from '../components/chat/ChatSearchBar.jsx';
import NewChatModal from '../components/chat/NewChatModal.jsx';
import NewGroupModal from '../components/chat/NewGroupModal.jsx';
import StoryRail from '../components/stories/StoryRail.jsx';
import { useChatStore } from '../store/chatStore.js';
import { useUiStore } from '../store/uiStore.js';
import { useFriendStore } from '../store/friendStore.js';
import { useAuth } from '../hooks/useAuth.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { getChats, getFriendRequests } from '../services/api.js';

function NotificationBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-primary px-1 text-[10px] font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Persistent header menu (avatar -> Profile / Settings / theme / Logout) — the one place, always
// visible regardless of route, that satisfies "logout reachable from a header/profile menu, not
// buried only in settings" (spec section 7). Lives here rather than a separate component since
// it's a single call site tightly coupled to this header row.
function AccountMenu() {
  const { user } = useAuth();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const pendingRequestCount = useFriendStore((s) => s.pendingRequestCount);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Account menu" className="relative">
        <Avatar src={user?.profileImageUrl} name={user?.name} size="sm" />
        {pendingRequestCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-gradient-primary ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-10 left-0 z-20 w-48 rounded-md border border-neutral-200 bg-elevated py-1 text-sm shadow-lg animate-scale-in">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <User className="h-4 w-4" /> Profile
              <NotificationBadge count={pendingRequestCount} />
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                useUiStore.getState().openModal('logout-confirm');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// "New Chat" vs "New Group" entry point (spec section 2.4) — a small dropdown next to the plus
// button, same inline-menu pattern as AccountMenu/MessageComposer's attach menu.
function NewMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button size="sm" variant="gradient" onClick={() => setOpen((v) => !v)}>
        <Plus className="h-4 w-4" />
        New
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-10 right-0 z-20 w-40 rounded-md border border-neutral-200 bg-elevated py-1 text-sm shadow-lg animate-scale-in">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                useUiStore.getState().openModal('new-chat');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <MessageCircle className="h-4 w-4" /> New Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                useUiStore.getState().openModal('new-group');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-neutral-50 dark:hover:bg-surface"
            >
              <Users className="h-4 w-4" /> New Group
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Single source of truth for the list+detail split (spec section 3): one route match derives
// `chatOpen`, and that one boolean drives which pane shows on mobile. Desktop (lg:) always shows
// both panes regardless of chatOpen — only the mobile stacked behavior branches on it.
export default function ChatLayout() {
  const chatOpen = !!useMatch('/chats/:chatId');
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    getChats().then((chats) => useChatStore.getState().setChats(chats));
  }, []);

  useEffect(() => {
    useChatStore.getState().setPinnedChatIds(user?.pinnedChats);
  }, [user?.pinnedChats]);

  useEffect(() => {
    getFriendRequests().then((requests) => {
      useFriendStore.getState().setPendingRequestCount(requests.length);
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface lg:grid lg:grid-cols-[minmax(280px,30%)_1fr]">
      <div
        className={`min-h-0 w-full flex-col border-neutral-200 lg:flex lg:border-r ${chatOpen ? 'hidden' : 'flex'}`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <AccountMenu />
            <h1 className="font-display text-lg font-semibold text-ink">Chats</h1>
          </div>
          <NewMenu />
        </div>

        <StoryRail />
        <ChatSearchBar value={query} onChange={setQuery} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatList query={debouncedQuery} />
        </div>

        <NewChatModal />
        <NewGroupModal />
      </div>

      <div className={`min-h-0 w-full min-w-0 flex-col lg:flex ${chatOpen ? 'flex' : 'hidden'}`}>
        <Outlet />
      </div>
    </div>
  );
}

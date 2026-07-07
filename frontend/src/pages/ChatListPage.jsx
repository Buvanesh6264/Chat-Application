import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/common/Button.jsx';
import ChatList from '../components/chat/ChatList.jsx';
import NewChatModal from '../components/chat/NewChatModal.jsx';
import StoryRail from '../components/stories/StoryRail.jsx';
import { useChatStore } from '../store/chatStore.js';
import { useUiStore } from '../store/uiStore.js';
import { getChats } from '../services/api.js';

export default function ChatListPage() {
  useEffect(() => {
    getChats().then((chats) => useChatStore.getState().setChats(chats));
  }, []);

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-neutral-900">Chats</h1>
        <Button size="sm" onClick={() => useUiStore.getState().openModal('new-chat')}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <StoryRail />

      <div className="flex-1 overflow-y-auto">
        <ChatList />
      </div>

      <NewChatModal />
    </div>
  );
}

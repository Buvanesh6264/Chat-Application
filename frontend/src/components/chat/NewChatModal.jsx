import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Spinner from '../common/Spinner.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { searchUsers, createDirectChat, getChats } from '../../services/api.js';

const DEBOUNCE_MS = 300;

export default function NewChatModal() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creatingId, setCreatingId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!phone.trim()) {
      setResults([]);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(phone.trim());
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [phone]);

  const handleSelect = async (user) => {
    setCreatingId(user.id);
    try {
      const chat = await createDirectChat(user.id);
      const chatId = chat.id ?? chat._id;
      const refreshed = await getChats();
      useChatStore.getState().setChats(refreshed);
      navigate(`/chats/${chatId}`);
      useUiStore.getState().closeModal();
      setPhone('');
      setResults([]);
    } catch {
      toast.error('Could not start chat');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <Modal id="new-chat" title="New Chat">
      <input
        autoFocus
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Search by phone number"
        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none"
      />

      <div className="mt-3 max-h-72 overflow-y-auto">
        {searching && (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        )}
        {!searching && phone.trim() && results.length === 0 && (
          <div className="py-3 text-center text-sm text-neutral-500">No users found</div>
        )}
        {results.map((user, i) => (
          <div
            key={user.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => handleSelect(user)}
              disabled={creatingId === user.id}
              className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors duration-150 hover:bg-neutral-50 disabled:opacity-50"
            >
              <Avatar src={user.profileImageUrl} name={user.name} size="sm" />
              <div>
                <div className="text-sm font-medium text-neutral-900">{user.name}</div>
                <div className="text-xs text-neutral-500">{user.phoneNumber}</div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

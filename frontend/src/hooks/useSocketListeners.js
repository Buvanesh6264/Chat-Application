import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore.js';
import { useStoryStore } from '../store/storyStore.js';
import { useFriendStore } from '../store/friendStore.js';

const TYPING_AUTO_CLEAR_MS = 5000;

// Registers all realtime chat/story listeners on the given socket and tears them down on
// unmount/socket-change. Store actions are read via getState() since these are event callbacks,
// not renders.
export const useSocketListeners = (socket) => {
  const typingTimeouts = useRef(new Map());

  useEffect(() => {
    if (!socket) return undefined;

    const handleMessageReceive = (message) => {
      useChatStore.getState().addMessage(message.chatId, message);
      useChatStore.getState().upsertChatOnMessage(message.chatId, message);
    };

    const handleMessageReplace = (message) => {
      useChatStore.getState().replaceMessage(message.chatId, message);
    };

    const handleMessageRead = ({ chatId, userId, upToMessageId }) => {
      useChatStore.getState().applyReadReceipt(chatId, userId, upToMessageId);
    };

    const handleTypingStart = ({ chatId, userId }) => {
      useChatStore.getState().setTyping(chatId, userId, true);

      const key = `${chatId}:${userId}`;
      clearTimeout(typingTimeouts.current.get(key));
      typingTimeouts.current.set(
        key,
        setTimeout(() => {
          useChatStore.getState().setTyping(chatId, userId, false);
          typingTimeouts.current.delete(key);
        }, TYPING_AUTO_CLEAR_MS)
      );
    };

    const handleTypingStop = ({ chatId, userId }) => {
      useChatStore.getState().setTyping(chatId, userId, false);
      const key = `${chatId}:${userId}`;
      clearTimeout(typingTimeouts.current.get(key));
      typingTimeouts.current.delete(key);
    };

    const handleStoryNew = (story) => {
      useStoryStore.getState().addStory(story);
    };

    const handleFriendRequestNew = () => {
      useFriendStore.getState().incrementPendingRequestCount();
    };

    const handleChatUnreadUpdate = ({ chatId, count }) => {
      useChatStore.getState().setUnreadCount(chatId, count);
    };

    socket.on('message:receive', handleMessageReceive);
    socket.on('message:edit', handleMessageReplace);
    socket.on('message:delete', handleMessageReplace);
    socket.on('message:reaction', handleMessageReplace);
    socket.on('message:transcript-ready', handleMessageReplace);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('story:new', handleStoryNew);
    socket.on('friend:request:new', handleFriendRequestNew);
    socket.on('chat:unreadUpdate', handleChatUnreadUpdate);

    return () => {
      socket.off('message:receive', handleMessageReceive);
      socket.off('message:edit', handleMessageReplace);
      socket.off('message:delete', handleMessageReplace);
      socket.off('message:reaction', handleMessageReplace);
      socket.off('message:transcript-ready', handleMessageReplace);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('story:new', handleStoryNew);
      socket.off('friend:request:new', handleFriendRequestNew);
      socket.off('chat:unreadUpdate', handleChatUnreadUpdate);

      for (const timeoutId of typingTimeouts.current.values()) clearTimeout(timeoutId);
      typingTimeouts.current.clear();
    };
  }, [socket]);
};

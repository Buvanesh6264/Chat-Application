import { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket.js';
import { useAuth } from './useAuth.js';

// Connects the socket once a user session exists; disconnects on unmount/logout.
export const useSocket = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    connectSocket();
    return () => disconnectSocket();
  }, [user]);

  return getSocket();
};

import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { useAuth } from './useAuth.js';

// Connects the socket once a user session exists; disconnects on unmount/logout.
export const useSocket = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    setSocket(connectSocket());
    return () => {
      disconnectSocket();
      setSocket(null);
    };
  }, [user]);

  return socket;
};

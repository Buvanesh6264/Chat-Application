import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket = null;

export const connectSocket = () => {
  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: getAccessToken() },
    autoConnect: true,
  });
  return socket;
};

// Call after a token refresh so the socket reconnects with the new access token.
export const reconnectSocketWithFreshToken = () => {
  if (!socket) return;
  socket.auth = { token: getAccessToken() };
  socket.disconnect().connect();
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

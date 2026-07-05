import jwt from 'jsonwebtoken';
import { registerPresenceHandlers } from './presence.handlers.js';
import { registerMessageHandlers } from './message.handlers.js';
import { registerTypingHandlers } from './typing.handlers.js';

// Auth handshake: verifies the access JWT and attaches the user id to the socket.
// Never trust a userId/senderId passed in an event payload — always read socket.data.userId.
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = payload.sub;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
};

export const registerSocketHandlers = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
  });
};

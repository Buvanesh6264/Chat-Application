import jwt from 'jsonwebtoken';
import { registerPresenceHandlers } from './presence.handlers.js';
import { registerMessageHandlers } from './message.handlers.js';
import { registerTypingHandlers } from './typing.handlers.js';
import { initRealtime } from '../services/realtime.js';

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
  initRealtime(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Every socket joins its own personal room — sending/broadcasting targets a user's room
    // rather than a per-chat room, so a brand-new chat never needs a stale-membership fix-up.
    socket.join(`user:${socket.data.userId}`);

    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
  });
};

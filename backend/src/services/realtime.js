// Lets services (transcription.js, and anything future that needs to push a live update) reach
// connected sockets without threading an `io` instance through every function signature. Set
// once at startup by sockets/index.js; a no-op if called before that (shouldn't happen in
// practice — registerSocketHandlers runs before any request can trigger a send).
let ioInstance = null;

export const initRealtime = (io) => {
  ioInstance = io;
};

export const emitToUser = (userId, event, payload) => {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
};

---
name: socket-event-skill
description: Standard emit/listen/ack pattern used across all socket.io event handlers, including identity, room-scoping, and presence/read-receipt enforcement.
---

# Socket event pattern

**Identity**: always read `socket.data.userId` (set once, during the auth handshake in `sockets/index.js`) — never trust a `userId`/`senderId` field in the event payload itself.

**Naming**: event pairs use `noun:verb` — `message:send` / `message:receive`, `message:edit`, `message:delete`, `message:read`, `message:reaction`, `typing:start` / `typing:stop`, `presence:update`, `story:new`. Client-to-server and server-to-client sides of the same concept share the noun.

**Handler shape**:
```js
// sockets/message.handlers.js
export const registerMessageHandlers = (io, socket) => {
  socket.on('message:send', async (payload, ack) => {
    const senderId = socket.data.userId; // never payload.senderId
    const message = await messageService.create(senderId, payload);
    io.to(roomFor(message.chatId)).emit('message:receive', message);
    ack?.({ ok: true, message });
  });
};
```

**Room-scoped emits only**: emit to `chatId`-based rooms (participants join on connect/chat-open), never `io.emit()` broadcast to everyone.

**Presence/read-receipt enforcement lives here, not the frontend**: before persisting/emitting a `message:read` event, check both users' `readReceiptsEnabled` via the `User` model (or a cached lookup) — if either has it disabled, suppress the receipt for both directions. Presence reads/writes go through `services/presence.js` exclusively, never a direct Map/Redis call from a handler.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { registerSocketHandlers } from '../src/sockets/index.js';
import { User } from '../src/models/User.js';
import { Message } from '../src/models/Message.js';

const app = createApp();
let httpServer;
let io;
let port;

beforeAll(async () => {
  httpServer = createServer(app);
  io = new Server(httpServer, { cors: { origin: '*' } });
  registerSocketHandlers(io);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

let phoneCounter = 0;
const uniquePhone = () => `+1416555${String(6000 + phoneCounter++)}`;

const signup = async (name) => {
  const phoneNumber = uniquePhone();
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, phoneNumber, password: 'correct-horse' });
  return { id: res.body.user.id, phoneNumber, accessToken: res.body.accessToken };
};

const createDirectChat = async (a, b) => {
  const res = await request(app)
    .post('/api/chats/direct')
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send({ userId: b.id });
  return res.body.chat._id;
};

const connectClient = (token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });

const waitForEvent = (socket, event, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe('sockets', () => {
  it('delivers message:send to the other participant via message:receive', async () => {
    const a = await signup('SocketA');
    const b = await signup('SocketB');
    const chatId = await createDirectChat(a, b);

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);

    const receivePromise = waitForEvent(socketB, 'message:receive');
    const ackPromise = new Promise((resolve) => {
      socketA.emit('message:send', { chatId, type: 'text', content: 'hi from socket' }, resolve);
    });

    const [ack, received] = await Promise.all([ackPromise, receivePromise]);
    expect(ack.ok).toBe(true);
    expect(received.content).toBe('hi from socket');

    socketA.disconnect();
    socketB.disconnect();
  });

  it('relays typing:start to the other participant only, not back to the sender', async () => {
    const a = await signup('TypingA');
    const b = await signup('TypingB');
    const chatId = await createDirectChat(a, b);

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);

    let selfEchoed = false;
    socketA.once('typing:start', () => {
      selfEchoed = true;
    });

    const typingPromise = waitForEvent(socketB, 'typing:start');
    socketA.emit('typing:start', { chatId });
    const typingPayload = await typingPromise;

    expect(typingPayload.userId).toBe(a.id);
    expect(selfEchoed).toBe(false);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('suppresses message:read when the reader has readReceiptsEnabled disabled', async () => {
    const a = await signup('ReadA');
    const b = await signup('ReadB');
    await User.findByIdAndUpdate(a.id, { readReceiptsEnabled: false });
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ chatId, type: 'text', content: 'read me' });
    expect(sendRes.status).toBe(201);

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);

    let receivedReadEvent = false;
    socketB.once('message:read', () => {
      receivedReadEvent = true;
    });

    const ack = await new Promise((resolve) => {
      socketA.emit('message:read', { chatId, upToMessageId: sendRes.body.message.id }, resolve);
    });
    expect(ack.ok).toBe(true);
    expect(ack.suppressed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(receivedReadEvent).toBe(false);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('records readBy and broadcasts message:read when both participants have receipts enabled', async () => {
    const a = await signup('ReadHappyA');
    const b = await signup('ReadHappyB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ chatId, type: 'text', content: 'please read me' });
    const messageId = sendRes.body.message.id;

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);

    const readEventPromise = waitForEvent(socketB, 'message:read');
    const ack = await new Promise((resolve) => {
      socketA.emit('message:read', { chatId, upToMessageId: messageId }, resolve);
    });
    const readEvent = await readEventPromise;

    expect(ack.ok).toBe(true);
    expect(ack.suppressed).toBeUndefined();
    expect(readEvent).toMatchObject({ chatId, userId: a.id, upToMessageId: messageId });

    const persisted = await Message.findById(messageId);
    expect(persisted.readBy).toHaveLength(1);
    expect(persisted.readBy[0].userId.toString()).toBe(a.id);
    expect(persisted.readBy[0].readAt).toBeInstanceOf(Date);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('toggles message:reaction on and off, and replaces a different emoji', async () => {
    const a = await signup('ReactionA');
    const b = await signup('ReactionB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ chatId, type: 'text', content: 'react to me' });
    const messageId = sendRes.body.message.id;

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);

    const react = (emoji) =>
      new Promise((resolve) => {
        socketB.emit('message:reaction', { messageId, emoji }, resolve);
      });

    const firstAck = await react('👍');
    expect(firstAck.ok).toBe(true);
    expect(firstAck.message.reactions).toEqual([{ userId: b.id, emoji: '👍' }]);

    // Different emoji from the same user replaces the existing one in place.
    const replaceAck = await react('❤️');
    expect(replaceAck.message.reactions).toEqual([{ userId: b.id, emoji: '❤️' }]);

    // Same emoji again toggles it off.
    const toggleOffAck = await react('❤️');
    expect(toggleOffAck.message.reactions).toEqual([]);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('pushes presence:update to a friend on connect and disconnect', async () => {
    const a = await signup('PresenceA');
    const b = await signup('PresenceB');

    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ to: b.id });
    await request(app)
      .post('/api/friends/respond')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ requestId: reqRes.body.request._id, action: 'accept' });

    const socketA = await connectClient(a.accessToken);

    const onlinePromise = waitForEvent(socketA, 'presence:update');
    const socketB = await connectClient(b.accessToken);
    const onlineUpdate = await onlinePromise;
    expect(onlineUpdate.userId).toBe(b.id);
    expect(onlineUpdate.isOnline).toBe(true);

    const offlinePromise = waitForEvent(socketA, 'presence:update');
    socketB.disconnect();
    const offlineUpdate = await offlinePromise;
    expect(offlineUpdate.userId).toBe(b.id);
    expect(offlineUpdate.isOnline).toBe(false);

    socketA.disconnect();
  });

  it('gates presence:update fields independently per privacy setting', async () => {
    const a = await signup('PresenceGateA');
    const b = await signup('PresenceGateB');

    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ to: b.id });
    await request(app)
      .post('/api/friends/respond')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ requestId: reqRes.body.request._id, action: 'accept' });

    // b hides online status entirely but leaves last-seen visible — these two enums must be
    // gated independently, the same invariant already proven for REST getProfile.
    await request(app)
      .patch('/api/users/me/privacy')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ onlineStatusVisibility: 'Nobody', lastSeenVisibility: 'Everyone' });

    const socketA = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);
    // Let b's connect-time presence:update (isOnline: true) pass before watching for disconnect.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const offlinePromise = waitForEvent(socketA, 'presence:update');
    socketB.disconnect();
    const offlineUpdate = await offlinePromise;

    expect(offlineUpdate.userId).toBe(b.id);
    expect(offlineUpdate.isOnline).toBeNull();
    expect(offlineUpdate.lastSeenAt).not.toBeNull();

    socketA.disconnect();
  });

  it('acks ok:false for message:send on a chat the sender is not part of', async () => {
    const a = await signup('AuthzA');
    const b = await signup('AuthzB');
    const c = await signup('AuthzC');
    const chatId = await createDirectChat(a, b);

    const socketC = await connectClient(c.accessToken);
    const ack = await new Promise((resolve) => {
      socketC.emit('message:send', { chatId, type: 'text', content: 'sneaky' }, resolve);
    });

    expect(ack.ok).toBe(false);
    socketC.disconnect();
  });
});

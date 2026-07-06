import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';

const app = createApp();

let phoneCounter = 0;
const uniquePhone = () => `+1415555${String(3000 + phoneCounter++)}`;

const signup = async (name) => {
  const phoneNumber = uniquePhone();
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, phoneNumber, password: 'correct-horse' });
  return { id: res.body.user.id, phoneNumber, accessToken: res.body.accessToken };
};

const authed = (token) => `Bearer ${token}`;

const becomeFriends = async (a, b) => {
  const reqRes = await request(app)
    .post('/api/friends/request')
    .set('Authorization', authed(a.accessToken))
    .send({ to: b.id });
  await request(app)
    .post('/api/friends/respond')
    .set('Authorization', authed(b.accessToken))
    .send({ requestId: reqRes.body.request._id, action: 'accept' });
};

describe('POST /api/chats/direct', () => {
  it('creates a chat between two users and finds the same one on a second call', async () => {
    const a = await signup('DirectA');
    const b = await signup('DirectB');

    const first = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(b.accessToken))
      .send({ userId: a.id });
    expect(second.status).toBe(201);
    expect(second.body.chat._id).toBe(first.body.chat._id);
  });

  it('rejects starting a chat with a blocked user', async () => {
    const a = await signup('BlockDirectA');
    const b = await signup('BlockDirectB');
    await becomeFriends(a, b);
    await request(app)
      .post('/api/friends/block')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });

    const res = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(b.accessToken))
      .send({ userId: a.id });
    expect(res.status).toBe(403);
  });
});

describe('message CRUD', () => {
  it('sends, lists, edits, and soft-deletes a message', async () => {
    const a = await signup('MsgA');
    const b = await signup('MsgB');
    const chatRes = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });
    const chatId = chatRes.body.chat._id;

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'text', content: 'hello there' });
    expect(sendRes.status).toBe(201);
    const messageId = sendRes.body.message.id;

    const listRes = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', authed(b.accessToken));
    expect(listRes.body.messages).toHaveLength(1);
    expect(listRes.body.messages[0].content).toBe('hello there');

    const chatsRes = await request(app)
      .get('/api/chats')
      .set('Authorization', authed(a.accessToken));
    expect(chatsRes.body.chats[0].lastMessage.id).toBe(messageId);

    const editRes = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', authed(a.accessToken))
      .send({ content: 'edited content' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.message.editedAt).not.toBeNull();

    // non-sender cannot edit
    const editByOtherRes = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', authed(b.accessToken))
      .send({ content: 'hijacked' });
    expect(editByOtherRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', authed(a.accessToken));
    expect(deleteRes.status).toBe(204);

    const listAfterDeleteRes = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', authed(b.accessToken));
    expect(listAfterDeleteRes.body.messages[0].content).toBeNull();

    // The deleted message is still Chat.lastMessage (soft-delete doesn't repoint it) — the chat
    // list must mask it the same way the message-list endpoint does, not leak the raw content.
    const chatsAfterDeleteRes = await request(app)
      .get('/api/chats')
      .set('Authorization', authed(b.accessToken));
    const chatSummary = chatsAfterDeleteRes.body.chats.find((c) => c._id === chatId);
    expect(chatSummary.lastMessage.id).toBe(messageId);
    expect(chatSummary.lastMessage.content).toBeNull();
  });

  it('rejects edit/delete outside the 15-minute window', async () => {
    const a = await signup('WindowA');
    const b = await signup('WindowB');
    const chatRes = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId: chatRes.body.chat._id, type: 'text', content: 'old message' });
    const messageId = sendRes.body.message.id;

    // Mongoose marks `createdAt` immutable when schema timestamps are enabled, so a normal
    // findByIdAndUpdate silently drops it — go around the schema via the raw driver collection.
    await Message.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(messageId) },
      { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } }
    );

    const editRes = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', authed(a.accessToken))
      .send({ content: 'too late' });
    expect(editRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', authed(a.accessToken));
    expect(deleteRes.status).toBe(403);
  });

  it('paginates messages with a cursor', async () => {
    const a = await signup('PageA');
    const b = await signup('PageB');
    const chatRes = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });
    const chatId = chatRes.body.chat._id;

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .post('/api/messages')
        .set('Authorization', authed(a.accessToken))
        .send({ chatId, type: 'text', content: `message ${i}` });
    }

    const firstPage = await request(app)
      .get(`/api/chats/${chatId}/messages?limit=3`)
      .set('Authorization', authed(a.accessToken));
    expect(firstPage.body.messages).toHaveLength(3);
    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await request(app)
      .get(`/api/chats/${chatId}/messages?limit=3&cursor=${firstPage.body.nextCursor}`)
      .set('Authorization', authed(a.accessToken));
    expect(secondPage.body.messages).toHaveLength(2);

    const firstIds = firstPage.body.messages.map((m) => m.id);
    const secondIds = secondPage.body.messages.map((m) => m.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });
});

describe('group chats', () => {
  it('creates a group, adds and removes members with admin enforcement', async () => {
    const owner = await signup('GroupOwner');
    const member = await signup('GroupMember');
    const outsider = await signup('GroupOutsider');

    const createRes = await request(app)
      .post('/api/chats/group')
      .set('Authorization', authed(owner.accessToken))
      .send({ groupName: 'Test Group', participantIds: [member.id] });
    expect(createRes.status).toBe(201);
    const groupId = createRes.body.chat._id;
    expect(createRes.body.chat.participants).toHaveLength(2);

    // non-admin cannot add members
    const addByMemberRes = await request(app)
      .post(`/api/chats/${groupId}/members`)
      .set('Authorization', authed(member.accessToken))
      .send({ userId: outsider.id });
    expect(addByMemberRes.status).toBe(403);

    // admin can add
    const addByOwnerRes = await request(app)
      .post(`/api/chats/${groupId}/members`)
      .set('Authorization', authed(owner.accessToken))
      .send({ userId: outsider.id });
    expect(addByOwnerRes.status).toBe(204);

    // member can remove themself (leave)
    const leaveRes = await request(app)
      .delete(`/api/chats/${groupId}/members/${member.id}`)
      .set('Authorization', authed(member.accessToken));
    expect(leaveRes.status).toBe(204);
  });
});

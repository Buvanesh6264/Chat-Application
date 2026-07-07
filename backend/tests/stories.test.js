import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import mongoose from 'mongoose';

// Storage talks to a real S3-compatible endpoint — mocked here so these tests verify the
// story/authorization logic in isolation, the same way mongodb-memory-server isolates Mongo.
vi.mock('../src/services/storage.js', () => ({
  headObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  createUploadUrl: vi.fn(),
}));

// eslint-disable-next-line import/order
import { headObject, createDownloadUrl } from '../src/services/storage.js';
import { createApp } from '../src/app.js';
import { registerSocketHandlers } from '../src/sockets/index.js';
import { Story } from '../src/models/Story.js';

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
const uniquePhone = () => `+1650555${String(8000 + phoneCounter++)}`;

const signup = async (name) => {
  const phoneNumber = uniquePhone();
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, phoneNumber, password: 'correct-horse' });
  return { id: res.body.user.id, phoneNumber, accessToken: res.body.accessToken };
};

const authed = (token) => `Bearer ${token}`;

const befriend = async (a, b) => {
  const reqRes = await request(app)
    .post('/api/friends/request')
    .set('Authorization', authed(a.accessToken))
    .send({ to: b.id });
  await request(app)
    .post('/api/friends/respond')
    .set('Authorization', authed(b.accessToken))
    .send({ requestId: reqRes.body.request._id, action: 'accept' });
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

beforeEach(() => {
  vi.mocked(headObject).mockReset().mockResolvedValue({ mimeType: 'image/jpeg', size: 1024 });
  vi.mocked(createDownloadUrl).mockReset().mockResolvedValue('https://fake-presigned-url.example/story.jpg');
});

describe('stories', () => {
  it('creates a story and delivers story:new to a friend and the poster\'s own other device, not to a non-friend', async () => {
    const a = await signup('StoryA');
    const b = await signup('StoryB');
    const c = await signup('StoryC');
    await befriend(a, b);

    const socketAOtherDevice = await connectClient(a.accessToken);
    const socketB = await connectClient(b.accessToken);
    const socketC = await connectClient(c.accessToken);

    const bPromise = waitForEvent(socketB, 'story:new');
    const aPromise = waitForEvent(socketAOtherDevice, 'story:new');
    let cReceived = false;
    socketC.once('story:new', () => {
      cReceived = true;
    });

    const postRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(a.accessToken))
      .send({ objectKey: `${a.id}/story.jpg`, caption: 'hello' });

    expect(postRes.status).toBe(201);
    expect(postRes.body.story.mediaUrl).toBe('https://fake-presigned-url.example/story.jpg');
    expect(postRes.body.story.caption).toBe('hello');

    const [bEvent, aEvent] = await Promise.all([bPromise, aPromise]);
    expect(bEvent.id).toBe(postRes.body.story.id);
    expect(aEvent.id).toBe(postRes.body.story.id);
    // The broadcast must never carry the owner-only viewedBy field, even for a friend receiving
    // their own story:new push — only the REST response (to the owner themselves) should have it.
    expect(bEvent.viewedBy).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(cReceived).toBe(false);

    socketAOtherDevice.disconnect();
    socketB.disconnect();
    socketC.disconnect();
  });

  it('rejects an objectKey that does not belong to the poster', async () => {
    const a = await signup('StoryOwnerA');
    const b = await signup('StoryOwnerB');

    const postRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(a.accessToken))
      .send({ objectKey: `${b.id}/not-mine.jpg` });

    expect(postRes.status).toBe(403);
    expect(headObject).not.toHaveBeenCalled();
  });

  it('feed includes own + friends\' active stories, excludes a non-friend\'s and an expired story', async () => {
    const a = await signup('FeedA');
    const b = await signup('FeedB');
    const c = await signup('FeedC'); // not a friend
    await befriend(a, b);

    const ownRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(a.accessToken))
      .send({ objectKey: `${a.id}/own.jpg` });

    const friendRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(b.accessToken))
      .send({ objectKey: `${b.id}/friend.jpg` });

    const nonFriendRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(c.accessToken))
      .send({ objectKey: `${c.id}/stranger.jpg` });

    // Expired story from the friend — backdated via the raw driver, same bypass pattern used
    // elsewhere for immutable/derived timestamps.
    const expiredRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(b.accessToken))
      .send({ objectKey: `${b.id}/expired.jpg` });
    await Story.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(expiredRes.body.story.id) },
      { $set: { expiresAt: new Date(Date.now() - 60 * 1000) } }
    );

    const feedRes = await request(app).get('/api/stories/feed').set('Authorization', authed(a.accessToken));
    const feedIds = feedRes.body.stories.map((s) => s.id);

    expect(feedIds).toContain(ownRes.body.story.id);
    expect(feedIds).toContain(friendRes.body.story.id);
    expect(feedIds).not.toContain(nonFriendRes.body.story.id);
    expect(feedIds).not.toContain(expiredRes.body.story.id);
  });

  it('marks a story viewed, reflects viewedByMe, and only exposes viewedBy to the owner', async () => {
    const a = await signup('ViewA');
    const b = await signup('ViewB');
    await befriend(a, b);

    const postRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(a.accessToken))
      .send({ objectKey: `${a.id}/view-me.jpg` });
    const storyId = postRes.body.story.id;

    const viewRes = await request(app)
      .post(`/api/stories/${storyId}/view`)
      .set('Authorization', authed(b.accessToken));
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.story.viewedByMe).toBe(true);

    const feedAsB = await request(app).get('/api/stories/feed').set('Authorization', authed(b.accessToken));
    const storyAsB = feedAsB.body.stories.find((s) => s.id === storyId);
    expect(storyAsB.viewedByMe).toBe(true);
    expect(storyAsB.viewedBy).toBeUndefined();

    const feedAsA = await request(app).get('/api/stories/feed').set('Authorization', authed(a.accessToken));
    const storyAsA = feedAsA.body.stories.find((s) => s.id === storyId);
    expect(storyAsA.viewedBy).toEqual([b.id]);
  });

  it('rejects a non-friend viewing attempt without revealing the story exists', async () => {
    const a = await signup('PrivViewA');
    const c = await signup('PrivViewC'); // not a friend

    const postRes = await request(app)
      .post('/api/stories')
      .set('Authorization', authed(a.accessToken))
      .send({ objectKey: `${a.id}/private.jpg` });

    const viewRes = await request(app)
      .post(`/api/stories/${postRes.body.story.id}/view`)
      .set('Authorization', authed(c.accessToken));

    expect(viewRes.status).toBe(404);
  });
});

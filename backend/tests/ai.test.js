import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import mongoose from 'mongoose';

// Both storage (S3-compatible) and Groq talk to real external services — mocked here so these
// tests verify the message/authorization/caching logic in isolation, the same way
// mongodb-memory-server isolates Mongo.
vi.mock('../src/services/storage.js', () => ({
  headObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  createUploadUrl: vi.fn(),
}));
vi.mock('../src/services/groq.js', () => ({
  transcribeAudio: vi.fn(),
  translateText: vi.fn(),
}));

// eslint-disable-next-line import/order
import { headObject, createDownloadUrl } from '../src/services/storage.js';
import { transcribeAudio, translateText } from '../src/services/groq.js';
import { createApp } from '../src/app.js';
import { registerSocketHandlers } from '../src/sockets/index.js';
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
const uniquePhone = () => `+1213555${String(7000 + phoneCounter++)}`;

const signup = async (name) => {
  const phoneNumber = uniquePhone();
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, phoneNumber, password: 'correct-horse' });
  return { id: res.body.user.id, phoneNumber, accessToken: res.body.accessToken };
};

const authed = (token) => `Bearer ${token}`;

const createDirectChat = async (a, b) => {
  const res = await request(app)
    .post('/api/chats/direct')
    .set('Authorization', authed(a.accessToken))
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

const sendVoiceMessage = async (sender, chatId) =>
  request(app)
    .post('/api/messages')
    .set('Authorization', authed(sender.accessToken))
    .send({ chatId, type: 'voice', objectKey: `${sender.id}/note.mp3`, mimeType: 'audio/mpeg', durationSeconds: 4.2 });

beforeEach(() => {
  vi.mocked(headObject).mockReset().mockResolvedValue({ mimeType: 'audio/mpeg', size: 2048 });
  vi.mocked(createDownloadUrl).mockReset().mockResolvedValue('https://fake-presigned-url.example/audio.mp3');
  vi.mocked(transcribeAudio).mockReset();
  vi.mocked(translateText).mockReset();
});

describe('voice transcription', () => {
  it('automatically transcribes a voice message and delivers it via message:transcript-ready', async () => {
    const a = await signup('TranscribeA');
    const b = await signup('TranscribeB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(transcribeAudio).mockResolvedValue('hello this is a test transcript');

    const socketB = await connectClient(b.accessToken);
    const transcriptPromise = waitForEvent(socketB, 'message:transcript-ready');

    const sendRes = await sendVoiceMessage(a, chatId);
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message.transcript).toBeNull();

    const transcriptEvent = await transcriptPromise;
    expect(transcriptEvent.id).toBe(sendRes.body.message.id);
    expect(transcriptEvent.transcript).toBe('hello this is a test transcript');
    expect(transcriptEvent.transcriptEdited).toBe(false);

    const persisted = await Message.findById(sendRes.body.message.id);
    expect(persisted.transcript).toBe('hello this is a test transcript');

    socketB.disconnect();
  });

  it('manually re-runs transcription via POST /ai/transcribe when the automatic run failed', async () => {
    const a = await signup('RetryA');
    const b = await signup('RetryB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(transcribeAudio).mockRejectedValueOnce(new Error('groq unavailable'));
    const sendRes = await sendVoiceMessage(a, chatId);
    const messageId = sendRes.body.message.id;

    // Let the auto-triggered (failing) transcription attempt finish before retrying manually.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const persistedAfterFailure = await Message.findById(messageId);
    expect(persistedAfterFailure.transcript).toBeNull();

    vi.mocked(transcribeAudio).mockResolvedValueOnce('manual retry transcript');
    const retryRes = await request(app)
      .post('/api/ai/transcribe')
      .set('Authorization', authed(a.accessToken))
      .send({ messageId });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.message.transcript).toBe('manual retry transcript');
  });

  it('rejects a non-sender retranscribe attempt', async () => {
    const a = await signup('OwnerRetryA');
    const b = await signup('OwnerRetryB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(transcribeAudio).mockResolvedValue('auto transcript');
    const sendRes = await sendVoiceMessage(a, chatId);

    const retryRes = await request(app)
      .post('/api/ai/transcribe')
      .set('Authorization', authed(b.accessToken))
      .send({ messageId: sendRes.body.message.id });

    expect(retryRes.status).toBe(404);
  });

  it('edits a transcript with no time-window restriction and broadcasts message:edit', async () => {
    const a = await signup('TransEditA');
    const b = await signup('TransEditB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(transcribeAudio).mockResolvedValue('original transcript');
    const sendRes = await sendVoiceMessage(a, chatId);
    const messageId = sendRes.body.message.id;
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Backdate createdAt well past the 15-minute content-edit window (Mongoose marks createdAt
    // immutable, so go around the schema via the raw driver — same pattern as chats.test.js).
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    await Message.collection.updateOne({ _id: new mongoose.Types.ObjectId(messageId) }, { $set: { createdAt: longAgo } });

    const socketB = await connectClient(b.accessToken);
    const editEventPromise = waitForEvent(socketB, 'message:edit');

    const editRes = await request(app)
      .patch(`/api/messages/${messageId}/transcript`)
      .set('Authorization', authed(a.accessToken))
      .send({ transcript: 'corrected transcript' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.message.transcript).toBe('corrected transcript');
    expect(editRes.body.message.transcriptEdited).toBe(true);

    const editEvent = await editEventPromise;
    expect(editEvent.transcript).toBe('corrected transcript');

    socketB.disconnect();
  });
});

describe('translation', () => {
  it('calls Groq once on a cache miss and serves subsequent identical requests from the cache', async () => {
    const a = await signup('TranslateA');
    const b = await signup('TranslateB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'text', content: 'hello there' });
    const messageId = sendRes.body.message.id;

    vi.mocked(translateText).mockResolvedValue('hola');

    const firstRes = await request(app)
      .post('/api/ai/translate')
      .set('Authorization', authed(b.accessToken))
      .send({ messageId, targetLanguage: 'Spanish' });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body).toMatchObject({ language: 'Spanish', text: 'hola', cached: false });
    expect(translateText).toHaveBeenCalledTimes(1);

    const secondRes = await request(app)
      .post('/api/ai/translate')
      .set('Authorization', authed(b.accessToken))
      .send({ messageId, targetLanguage: 'Spanish' });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toMatchObject({ language: 'Spanish', text: 'hola', cached: true });
    expect(translateText).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached translations when the message content is edited', async () => {
    const a = await signup('InvalidateA');
    const b = await signup('InvalidateB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'text', content: 'original text' });
    const messageId = sendRes.body.message.id;

    vi.mocked(translateText).mockResolvedValue('translated original');
    await request(app)
      .post('/api/ai/translate')
      .set('Authorization', authed(b.accessToken))
      .send({ messageId, targetLanguage: 'French' });

    const beforeEdit = await Message.findById(messageId);
    expect(beforeEdit.translatedContent).toHaveLength(1);

    await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', authed(a.accessToken))
      .send({ content: 'edited text' });

    const afterEdit = await Message.findById(messageId);
    expect(afterEdit.translatedContent).toHaveLength(0);
  });

  it('rejects translation requests from a non-participant', async () => {
    const a = await signup('NonPartA');
    const b = await signup('NonPartB');
    const c = await signup('NonPartC');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'text', content: 'secret' });

    const res = await request(app)
      .post('/api/ai/translate')
      .set('Authorization', authed(c.accessToken))
      .send({ messageId: sendRes.body.message.id, targetLanguage: 'German' });

    expect(res.status).toBe(404);
    expect(translateText).not.toHaveBeenCalled();
  });
});

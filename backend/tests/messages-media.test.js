import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Storage talks to a real S3-compatible endpoint — mocked here so these tests verify the
// message/authorization logic in isolation, the same way mongodb-memory-server isolates Mongo.
vi.mock('../src/services/storage.js', () => ({
  headObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  createUploadUrl: vi.fn(),
}));

// eslint-disable-next-line import/order
import { headObject, createDownloadUrl } from '../src/services/storage.js';
import { createApp } from '../src/app.js';

const app = createApp();

let phoneCounter = 0;
const uniquePhone = () => `+1415555${String(4000 + phoneCounter++)}`;

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

beforeEach(() => {
  vi.mocked(headObject).mockReset();
  vi.mocked(createDownloadUrl).mockReset();
  vi.mocked(createDownloadUrl).mockResolvedValue('https://fake-presigned-url.example/object');
});

describe('media messages', () => {
  it('attaches a photo message when the uploaded object matches the allowlist', async () => {
    const a = await signup('MediaA');
    const b = await signup('MediaB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(headObject).mockResolvedValue({ mimeType: 'image/png', size: 1024 });

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'photo', objectKey: `${a.id}/test.png`, mimeType: 'image/png', content: 'a caption' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message.type).toBe('photo');
    expect(sendRes.body.message.mediaUrl).toBe('https://fake-presigned-url.example/object');
    expect(sendRes.body.message.mediaMeta.mimeType).toBe('image/png');
    expect(sendRes.body.message.mediaMeta.size).toBe(1024);
    expect(sendRes.body.message.content).toBe('a caption');

    const listRes = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', authed(b.accessToken));
    expect(listRes.body.messages[0].mediaUrl).toBe('https://fake-presigned-url.example/object');
  });

  it('rejects an objectKey that does not belong to the sender', async () => {
    const a = await signup('OwnerCheckA');
    const b = await signup('OwnerCheckB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'photo', objectKey: `${b.id}/not-mine.png`, mimeType: 'image/png' });

    expect(sendRes.status).toBe(403);
    expect(headObject).not.toHaveBeenCalled();
  });

  it('rejects a mismatched mime type reported by headObject', async () => {
    const a = await signup('MimeA');
    const b = await signup('MimeB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(headObject).mockResolvedValue({ mimeType: 'application/x-msdownload', size: 1024 });

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'photo', objectKey: `${a.id}/evil.exe`, mimeType: 'image/png' });

    expect(sendRes.status).toBe(400);
  });

  it('rejects a file over the size limit for its category', async () => {
    const a = await signup('SizeA');
    const b = await signup('SizeB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(headObject).mockResolvedValue({ mimeType: 'image/png', size: 999 * 1024 * 1024 });

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'photo', objectKey: `${a.id}/huge.png`, mimeType: 'image/png' });

    expect(sendRes.status).toBe(400);
  });

  it('attaches a voice message with durationSeconds and leaves transcript unset', async () => {
    const a = await signup('VoiceA');
    const b = await signup('VoiceB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(headObject).mockResolvedValue({ mimeType: 'audio/mpeg', size: 2048 });

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({
        chatId,
        type: 'voice',
        objectKey: `${a.id}/note.mp3`,
        mimeType: 'audio/mpeg',
        durationSeconds: 12.5,
      });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message.mediaMeta.durationSeconds).toBe(12.5);
    expect(sendRes.body.message.transcript).toBeNull();
    expect(sendRes.body.message.transcriptEdited).toBe(false);
  });

  it('rejects attaching an object that was never uploaded', async () => {
    const a = await signup('MissingA');
    const b = await signup('MissingB');
    const chatId = await createDirectChat(a, b);

    vi.mocked(headObject).mockRejectedValue(new Error('NotFound'));

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'photo', objectKey: `${a.id}/never-uploaded.png`, mimeType: 'image/png' });

    expect(sendRes.status).toBe(400);
  });

  it('requires durationSeconds for voice messages', async () => {
    const a = await signup('NoDurationA');
    const b = await signup('NoDurationB');
    const chatId = await createDirectChat(a, b);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', authed(a.accessToken))
      .send({ chatId, type: 'voice', objectKey: `${a.id}/note.mp3`, mimeType: 'audio/mpeg' });

    expect(sendRes.status).toBe(400);
    expect(headObject).not.toHaveBeenCalled();
  });
});

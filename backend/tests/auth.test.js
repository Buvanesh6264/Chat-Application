import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

const app = createApp();

// Each test uses its own phone number so the (IP, phone)-keyed rate limiter — a real, in-memory,
// process-lifetime store — doesn't accumulate attempts across unrelated tests.
let phoneCounter = 0;
const uniquePhone = () => `+1415555${String(1000 + phoneCounter++)}`;

const makeSignupBody = (overrides = {}) => ({
  name: 'Ada Lovelace',
  phoneNumber: uniquePhone(),
  password: 'correct-horse',
  ...overrides,
});

describe('POST /api/auth/signup', () => {
  it('creates a user with a hashed password and returns an access token + refresh cookie', async () => {
    const body = makeSignupBody();
    const res = await request(app).post('/api/auth/signup').send(body);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user.phoneNumber).toBe(body.phoneNumber);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);

    const stored = await User.findOne({ phoneNumber: body.phoneNumber }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe(body.password);
  });

  it('rejects a duplicate phone number', async () => {
    const body = makeSignupBody();
    await request(app).post('/api/auth/signup').send(body);
    const res = await request(app).post('/api/auth/signup').send(body);

    expect(res.status).toBe(409);
  });

  it('rejects a non-E.164 phone number', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(makeSignupBody({ phoneNumber: '4155551234' }));

    expect(res.status).toBe(400);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(makeSignupBody({ password: 'short' }));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and issues tokens', async () => {
    const body = makeSignupBody();
    await request(app).post('/api/auth/signup').send(body);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: body.phoneNumber, password: body.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('rejects an incorrect password', async () => {
    const body = makeSignupBody();
    await request(app).post('/api/auth/signup').send(body);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: body.phoneNumber, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and rejects the old one after rotation', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send(makeSignupBody());
    const cookie = signupRes.headers['set-cookie'][0];

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf('string');
    const newCookie = refreshRes.headers['set-cookie'][0];
    expect(newCookie).not.toBe(cookie);

    // old (rotated-out) refresh token must now be rejected
    const reuseRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(reuseRes.status).toBe(401);

    // new refresh token still works
    const secondRefresh = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(secondRefresh.status).toBe(200);
  });

  it('rejects a missing refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send(makeSignupBody());
    const cookie = signupRes.headers['set-cookie'][0];

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('blocks login after too many attempts for the same IP+phone', async () => {
    const body = makeSignupBody();
    await request(app).post('/api/auth/signup').send(body);

    const results = [];
    for (let i = 0; i < 6; i += 1) {
      // sequential: rate limiter state must accumulate in request order
      // eslint-disable-next-line no-await-in-loop
      results.push(
        await request(app)
          .post('/api/auth/login')
          .send({ phoneNumber: body.phoneNumber, password: 'wrong-password' })
      );
    }

    expect(results[5].status).toBe(429);
  });
});

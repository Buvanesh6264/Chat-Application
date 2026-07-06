import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

const app = createApp();

let phoneCounter = 0;
const uniquePhone = () => `+1415555${String(2000 + phoneCounter++)}`;

const signup = async (name) => {
  const phoneNumber = uniquePhone();
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, phoneNumber, password: 'correct-horse' });
  return { id: res.body.user.id, phoneNumber, accessToken: res.body.accessToken };
};

const authed = (userToken) => `Bearer ${userToken}`;

describe('GET /api/users/search', () => {
  it('finds another user by partial phone number', async () => {
    const me = await signup('Searcher');
    const target = await signup('Findme');

    const res = await request(app)
      .get(`/api/users/search?phone=${encodeURIComponent(target.phoneNumber.slice(-6))}`)
      .set('Authorization', authed(me.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.users.some((u) => u.id === target.id)).toBe(true);
  });
});

describe('privacy-gated profile reads', () => {
  it('nulls profile fields from non-friends when set to Friends, reveals them once accepted', async () => {
    const owner = await signup('Owner');
    const viewer = await signup('Viewer');

    await request(app)
      .patch('/api/users/me/privacy')
      .set('Authorization', authed(owner.accessToken))
      .send({ profileVisibility: 'Friends' });

    const gatedRes = await request(app)
      .get(`/api/users/${owner.id}/profile`)
      .set('Authorization', authed(viewer.accessToken));
    // Not blocked, just not-yet-friends — profile is a 200 with the gated fields nulled, not a 404.
    expect(gatedRes.status).toBe(200);
    expect(gatedRes.body.user.name).toBeNull();
    expect(gatedRes.body.user.phoneNumber).toBeNull();

    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', authed(viewer.accessToken))
      .send({ to: owner.id });
    expect(reqRes.status).toBe(201);

    const pendingRes = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', authed(owner.accessToken));
    expect(pendingRes.body.requests).toHaveLength(1);

    const acceptRes = await request(app)
      .post('/api/friends/respond')
      .set('Authorization', authed(owner.accessToken))
      .send({ requestId: pendingRes.body.requests[0]._id, action: 'accept' });
    expect(acceptRes.status).toBe(200);

    const visibleRes = await request(app)
      .get(`/api/users/${owner.id}/profile`)
      .set('Authorization', authed(viewer.accessToken));
    expect(visibleRes.status).toBe(200);
    expect(visibleRes.body.user.name).toBe('Owner');
  });

  it('gates profileVisibility and lastSeenVisibility independently', async () => {
    const owner = await signup('IndependentOwner');
    const viewer = await signup('IndependentViewer');
    const realLastSeen = new Date('2026-01-01T00:00:00.000Z');
    await User.findByIdAndUpdate(owner.id, { lastSeenAt: realLastSeen });

    await request(app)
      .patch('/api/users/me/privacy')
      .set('Authorization', authed(owner.accessToken))
      .send({ profileVisibility: 'Nobody', lastSeenVisibility: 'Everyone' });

    const res = await request(app)
      .get(`/api/users/${owner.id}/profile`)
      .set('Authorization', authed(viewer.accessToken));

    expect(res.status).toBe(200);
    // profileVisibility=Nobody -> name/phone hidden even though the viewer is a stranger
    expect(res.body.user.name).toBeNull();
    // lastSeenVisibility=Everyone -> the real value comes through despite profileVisibility
    // being restrictive — proves the two enums are gated independently, not coupled.
    expect(new Date(res.body.user.lastSeenAt).getTime()).toBe(realLastSeen.getTime());
  });
});

describe('POST /api/friends/block', () => {
  it('removes both users from each others friends and hides the blocker from search', async () => {
    const a = await signup('BlockerA');
    const b = await signup('BlockedB');

    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', authed(a.accessToken))
      .send({ to: b.id });

    await request(app)
      .post('/api/friends/respond')
      .set('Authorization', authed(b.accessToken))
      .send({ requestId: reqRes.body.request._id, action: 'accept' });

    const blockRes = await request(app)
      .post('/api/friends/block')
      .set('Authorization', authed(a.accessToken))
      .send({ userId: b.id });
    expect(blockRes.status).toBe(204);

    const searchRes = await request(app)
      .get(`/api/users/search?phone=${encodeURIComponent(a.phoneNumber.slice(-6))}`)
      .set('Authorization', authed(b.accessToken));
    expect(searchRes.body.users.some((u) => u.id === a.id)).toBe(false);

    // a re-request should be rejected while blocked
    const reReqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', authed(b.accessToken))
      .send({ to: a.id });
    expect(reReqRes.status).toBe(403);
  });
});

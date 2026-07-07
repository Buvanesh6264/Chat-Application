import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Module-load time, not inside beforeAll: services/groq.js constructs its client as soon as it's
// imported and the SDK validates the key's presence eagerly. Every test file transitively imports
// it via services/messages.js, even when groq.js itself is mocked — by the time beforeAll runs,
// that import (and the throw) has already happened, so this must be set before the test file's
// own imports are resolved.
process.env.JWT_SECRET ??= 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET ??= 'test_jwt_refresh_secret';
process.env.GROQ_API_KEY ??= 'test_groq_key';
process.env.GROQ_STT_MODEL ??= 'whisper-large-v3';
process.env.GROQ_TRANSLATE_MODEL ??= 'llama-3.3-70b-versatile';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

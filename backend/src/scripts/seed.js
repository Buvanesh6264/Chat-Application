import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';

// Local dev seed only — one known test account for manual/browser testing.
const SEED_USER = {
  name: 'Test User One',
  phoneNumber: '+15555550100',
  password: 'TestPassword123!',
};

const run = async () => {
  await connectDB(process.env.MONGO_URI);

  const existing = await User.findOne({ phoneNumber: SEED_USER.phoneNumber });
  if (existing) {
    console.log(`Seed user already exists: id=${existing._id} phone=${existing.phoneNumber}`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_USER.password, 12);
    const user = await User.create({
      name: SEED_USER.name,
      phoneNumber: SEED_USER.phoneNumber,
      passwordHash,
    });
    console.log(`Seeded user: id=${user._id} phone=${user.phoneNumber}`);
  }

  console.log(`Login with phone=${SEED_USER.phoneNumber} password=${SEED_USER.password}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

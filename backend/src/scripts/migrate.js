import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Story } from '../models/Story.js';

const MODELS = [User, FriendRequest, Chat, Message, Story];

const run = async () => {
  await connectDB(process.env.MONGO_URI);

  for (const model of MODELS) {
    // eslint-disable-next-line no-await-in-loop
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    console.log(`${model.modelName}: synced ${indexes.length} indexes`);
    indexes.forEach((idx) => console.log(`  - ${idx.name}`));
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { loadEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { registerSocketHandlers } from './sockets/index.js';

const env = loadEnv();

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

registerSocketHandlers(io);

const start = async () => {
  await connectDB(env.MONGO_URI);
  httpServer.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
};

start().catch((err) => {
  console.error('Fatal startup error — check MONGO_URI in .env:', err.message);
  process.exit(1);
});

const shutdown = () => {
  console.log('Shutting down...');
  httpServer.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

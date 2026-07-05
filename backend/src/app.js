import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import friendsRoutes from './routes/friends.routes.js';
import chatsRoutes from './routes/chats.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import storiesRoutes from './routes/stories.routes.js';
import aiRoutes from './routes/ai.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/friends', friendsRoutes);
  app.use('/api/chats', chatsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/stories', storiesRoutes);
  app.use('/api/ai', aiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

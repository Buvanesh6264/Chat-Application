import mongoose from 'mongoose';

export const connectDB = async (uri, { dbName = 'chat-app' } = {}) => {
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));

  // Explicit dbName so a URI with no database in its path (e.g. a bare trailing `/`) doesn't
  // silently land in a database named "test".
  await mongoose.connect(uri, { dbName });
  return mongoose.connection;
};

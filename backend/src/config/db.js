import mongoose from 'mongoose';

export const connectDB = async (uri) => {
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));

  await mongoose.connect(uri);
  return mongoose.connection;
};

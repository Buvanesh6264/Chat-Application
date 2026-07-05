const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

export const loadEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5000,
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_STT_MODEL: process.env.GROQ_STT_MODEL,
    GROQ_TRANSLATE_MODEL: process.env.GROQ_TRANSLATE_MODEL,
    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    RATE_LIMIT_MAX_ATTEMPTS: Number(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5,
  };
};

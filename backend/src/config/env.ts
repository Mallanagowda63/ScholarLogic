import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || process.env.MONGODB_URI || '',
  MONGODB_URI: process.env.DATABASE_URL || process.env.MONGODB_URI || '',
  USE_MEMORY_DB: process.env.USE_MEMORY_DB === 'true',
  
  // Supabase Storage Secrets (Backend Only)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',

  // Google Gemini AI Secrets (Backend Only)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  JWT_SECRET: process.env.JWT_SECRET || 'your_generated_secret_1',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your_generated_secret_2',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  STORAGE_PATH: process.env.STORAGE_PATH || './uploads',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',
};

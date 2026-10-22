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
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',

  JWT_SECRET: process.env.JWT_SECRET || 'your_generated_secret_1',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your_generated_secret_2',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  STORAGE_PATH: process.env.STORAGE_PATH || './uploads',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',

  // Shared secret sent by the Google Apps Script as X-ScholarLogic-Secret (integration disabled if empty)
  GOOGLE_FORM_WEBHOOK_SECRET: process.env.GOOGLE_FORM_WEBHOOK_SECRET || '',
  // Apps Script web-app URL (…/exec) that ScholarLogic pulls responses from, and how often (minutes, 0 = manual only)
  GOOGLE_FORM_SYNC_URL: (process.env.GOOGLE_FORM_SYNC_URL || '').trim(),
  GOOGLE_FORM_SYNC_INTERVAL_MINUTES: process.env.GOOGLE_FORM_SYNC_INTERVAL_MINUTES || '5',

  // eSSL/ZKTeco ADMS push: comma-separated device serial numbers allowed to post punches (empty = accept any)
  BIOMETRIC_DEVICE_SERIALS: (process.env.BIOMETRIC_DEVICE_SERIALS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Offset of the device clock from UTC in minutes (IST = 330); device timestamps carry no zone
  BIOMETRIC_TZ_OFFSET_MINUTES: Number(process.env.BIOMETRIC_TZ_OFFSET_MINUTES || 330),
  // Shift window a punch must fall in to count ("HH:mm")
  BIOMETRIC_SHIFT_START: process.env.BIOMETRIC_SHIFT_START || '07:00',
  BIOMETRIC_SHIFT_END: process.env.BIOMETRIC_SHIFT_END || '20:00',
  // When every punch of a day carries the same IN/OUT state (machine left on one key), treat the first as IN and the last as OUT
  BIOMETRIC_PAIR_SINGLE_STATE: process.env.BIOMETRIC_PAIR_SINGLE_STATE !== 'false',
  // First E Number to hand out when no student has one yet; later numbers continue from the highest in use
  BIOMETRIC_ENUMBER_START: Math.max(1, Number(process.env.BIOMETRIC_ENUMBER_START || 1)),
  // ADMS command used to write a user to the machine: "DATA UPDATE USERINFO" (push protocol 2.x) or "DATA USER" (older firmware)
  BIOMETRIC_USER_COMMAND: (process.env.BIOMETRIC_USER_COMMAND || 'DATA UPDATE USERINFO').trim(),
  // E Numbers (machine codes such as SCLR245) are given by the admins in eSSL Web. Only when this is
  // "true" does ScholarLogic hand out numbers itself (new students, cards, "Assign E Numbers").
  BIOMETRIC_AUTO_ENUMBER: process.env.BIOMETRIC_AUTO_ENUMBER === 'true',
  // Read users and punches straight from the machine over its PC-connection port (read-only).
  // Empty host = off. The machine keeps pushing to eSSL Web as before.
  ESSL_DEVICE_HOST: (process.env.ESSL_DEVICE_HOST || '').trim(),
  ESSL_DEVICE_PORT: Number(process.env.ESSL_DEVICE_PORT || 4370),
  ESSL_COMM_KEY: Number(process.env.ESSL_COMM_KEY || 0),
  ESSL_PULL_INTERVAL_MINUTES: Number(process.env.ESSL_PULL_INTERVAL_MINUTES || 5),
  // Shared secret for the campus helper that reads the machine on the campus network and posts here. Empty = off
  ESSL_AGENT_SECRET: (process.env.ESSL_AGENT_SECRET || '').trim(),
};

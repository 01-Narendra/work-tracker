import fs from 'fs';
import crypto from 'crypto';
import { SERVER_ENV_FILE, ROOT_ENV_FILE } from './paths.js';

// Attempt to load .env file if process.loadEnvFile is available
if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync(SERVER_ENV_FILE)) {
    try {
      process.loadEnvFile(SERVER_ENV_FILE);
    } catch {}
  } else if (fs.existsSync(ROOT_ENV_FILE)) {
    try {
      process.loadEnvFile(ROOT_ENV_FILE);
    } catch {}
  }
}

export const PORT = Number(process.env.PORT) || 3000;
export const TZ = process.env.TZ_NAME || 'Asia/Kolkata';
export const WEEKLY_OFF = process.env.WEEKLY_OFF ?? '0,6';
export const MAX_UPDATE_LEN = 2000;
export const MONGODB_URI = process.env.MONGODB_URI || '';

let secret = process.env.JWT_SECRET;
if (!secret) {
  console.warn('JWT_SECRET not set: everyone is logged out on every restart.');
  secret = crypto.randomBytes(32).toString('hex');
}
export const JWT_SECRET = secret;

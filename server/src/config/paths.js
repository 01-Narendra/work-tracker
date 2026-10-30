import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SERVER_DIR is <...>/server
export const SERVER_DIR = path.resolve(__dirname, '../..');

// ROOT_DIR is <...>/work-tracker (or workspace root containing client and server)
export const ROOT_DIR = path.resolve(SERVER_DIR, '..');

// Primary DATA_DIR is inside server/data; fallback is ROOT_DIR/data
const SERVER_DATA_DIR = path.join(SERVER_DIR, 'data');
const ROOT_DATA_DIR = path.join(ROOT_DIR, 'data');

export const DATA_DIR = fs.existsSync(SERVER_DATA_DIR) ? SERVER_DATA_DIR : ROOT_DATA_DIR;

// Primary USERS_FILE is in DATA_DIR; legacy fallbacks supported
export const USERS_FILE = path.join(SERVER_DATA_DIR, 'users.json');
export const LEGACY_DATA_USERS_FILE = path.join(ROOT_DATA_DIR, 'users.json');
export const ROOT_USERS_FILE = path.join(ROOT_DIR, 'users.json');

// Excel storage path
export const EXCEL_FILE = path.join(SERVER_DATA_DIR, 'work_updates.xlsx');
export const LEGACY_EXCEL_FILE = path.join(ROOT_DATA_DIR, 'work_updates.xlsx');

// Client dist path for static serving
export const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client', 'dist');

// Env file paths
export const SERVER_ENV_FILE = path.join(SERVER_DIR, '.env');
export const ROOT_ENV_FILE = path.join(ROOT_DIR, '.env');


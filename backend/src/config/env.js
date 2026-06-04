import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  worldCupApiUrl: process.env.WORLD_CUP_API_URL || 'https://worldcup26.ir',
  worldCupSyncEmail: process.env.WORLD_CUP_SYNC_EMAIL || '',
  worldCupSyncPassword: process.env.WORLD_CUP_SYNC_PASSWORD || '',
  /** API-Sports Football v3 — header x-apisports-key */
  apiFootballKey: process.env.API_FOOTBALL_KEY || '',
  /** Plan free: 2022–2024. Plan pago: 2026 para Mundial actual. */
  apiFootballSeason: Number(process.env.API_FOOTBALL_SEASON || 2024),
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || 60000),
  simulationEnabled: process.env.SIMULATION_ENABLED !== 'false',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminJwtExpires: process.env.ADMIN_JWT_EXPIRES || '8h',
};

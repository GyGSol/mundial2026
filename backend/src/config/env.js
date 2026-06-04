import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  worldCupApiUrl: process.env.WORLD_CUP_API_URL || 'https://worldcup26.ir',
  worldCupSyncEmail: process.env.WORLD_CUP_SYNC_EMAIL || '',
  worldCupSyncPassword: process.env.WORLD_CUP_SYNC_PASSWORD || '',
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || 60000),
  simulationEnabled: process.env.SIMULATION_ENABLED !== 'false',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminJwtExpires: process.env.ADMIN_JWT_EXPIRES || '8h',
};

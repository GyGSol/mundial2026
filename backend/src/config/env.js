import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_USER_DEFAULT_EMAIL } from '../constants/aiUser.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

dotenv.config({ path: join(repoRoot, '.env') });

const envFileName = process.env.ENV_FILE;
if (envFileName) {
  const envPath = envFileName.startsWith('/')
    ? envFileName
    : join(repoRoot, envFileName);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

export const env = {
  port: Number(process.env.PORT || 5000),
  appEnv:
    process.env.APP_ENV ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  worldCupApiUrl: process.env.WORLD_CUP_API_URL || 'https://worldcup26.ir',
  worldCupSyncEmail: process.env.WORLD_CUP_SYNC_EMAIL || '',
  worldCupSyncPassword: process.env.WORLD_CUP_SYNC_PASSWORD || '',
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || 60000),
  syncIntervalLiveMs: Number(process.env.SYNC_INTERVAL_LIVE_MS || 15000),
  liveFifaRefreshMs: Number(process.env.LIVE_FIFA_REFRESH_MS || 30000),
  kickoffWatchIntervalMs: Number(process.env.KICKOFF_WATCH_MS || 15000),
  kickoffWatchLiveMs: Number(process.env.KICKOFF_WATCH_LIVE_MS || 15000),
  predictionLockReminderIntervalMs: Number(process.env.PREDICTION_LOCK_REMINDER_INTERVAL_MS || 60000),
  simulationEnabled: process.env.SIMULATION_ENABLED !== 'false',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminJwtExpires: process.env.ADMIN_JWT_EXPIRES || '8h',
  footballDataApiToken: process.env.FOOTBALL_DATA_API_TOKEN || '',
  footballDataApiUrl: process.env.FOOTBALL_DATA_API_URL || 'https://api.football-data.org/v4',
  fifaApiUrl: process.env.FIFA_API_URL || 'https://api.fifa.com/api/v3',
  fifaCompetitionId: process.env.FIFA_COMPETITION_ID || '17',
  fifaSeasonId: process.env.FIFA_SEASON_ID || '285023',
  fifaReportAssetPrefix: process.env.FIFA_REPORT_ASSET_PREFIX || 'ce281',
  fifaReportIdBase: Number(process.env.FIFA_REPORT_ID_BASE || 12451),
  aiPredictionsEnabled: process.env.AI_PREDICTIONS_ENABLED !== 'false',
  aiUserEmail: (process.env.AI_USER_EMAIL || AI_USER_DEFAULT_EMAIL).toLowerCase().trim(),
  cerebrasApiKey: process.env.CEREBRAS_API_KEY || '',
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  aiDefaultProvider: (process.env.AI_DEFAULT_PROVIDER || 'cerebras').toLowerCase().trim(),
  /** Consultas humanas: preferir Gemini/Groq y reservar Cerebras/Oracle para el bot. */
  aiHumanDefaultProvider: (process.env.AI_HUMAN_DEFAULT_PROVIDER || 'gemini').toLowerCase().trim(),
  aiHumanCerebrasEnabled: process.env.AI_HUMAN_CEREBRAS_ENABLED === 'true',
  aiHumanLimitsEnabled: process.env.AI_HUMAN_LIMITS_ENABLED !== 'false',
  aiHumanInsightDailyLimit: Number(process.env.AI_HUMAN_INSIGHT_DAILY_LIMIT || 5),
  aiHumanQuestionDailyLimit: Number(process.env.AI_HUMAN_QUESTION_DAILY_LIMIT || 30),
  aiHumanPlayerIntelDailyLimit: Number(process.env.AI_HUMAN_PLAYER_INTEL_DAILY_LIMIT || 10),
  aiHumanHourlyLimit: Number(process.env.AI_HUMAN_HOURLY_LIMIT || 15),
  /** Bot IA: predice ~1 h antes del kickoff (alineado al cierre humano T-1 h). */
  aiPredictLeadMs: Number(process.env.AI_PREDICT_LEAD_MS || 60 * 60 * 1000),
  aiPredictWindowMs: Number(process.env.AI_PREDICT_WINDOW_MS || 2 * 60 * 1000),
  aiPredictJobIntervalMs: Number(process.env.AI_PREDICT_JOB_INTERVAL_MS || 60 * 1000),
  aiCerebrasModel: process.env.AI_CEREBRAS_MODEL || 'gpt-oss-120b',
  aiGeminiModel: process.env.AI_GEMINI_MODEL || 'gemini-2.5-flash',
  aiGroqModel: process.env.AI_GROQ_MODEL || 'llama-3.3-70b-versatile',
  oracleStructuredOutput: process.env.ORACLE_STRUCTURED_OUTPUT !== 'false',
  oracleLiveAdjustmentMs: Number(process.env.ORACLE_LIVE_ADJUSTMENT_MS || 30000),
  oracleInternalSecret: process.env.ORACLE_INTERNAL_SECRET || '',
  openfootballCacheDir: process.env.OPENFOOTBALL_CACHE_DIR || 'training/data/openfootball',
  trainingBufferExportCron: process.env.TRAINING_BUFFER_EXPORT_CRON || '0 3 * * 0',
  trainingBufferAlwaysRecord: process.env.TRAINING_BUFFER_ALWAYS_RECORD === 'true',
  /** Cuota Cerebras (defaults conservadores — trial ~30K TPM). */
  cerebrasMaxTpm: Number(process.env.CEREBRAS_MAX_TPM || 25_000),
  cerebrasMaxRpm: Number(process.env.CEREBRAS_MAX_RPM || 4),
  cerebrasMinGapMs: Number(process.env.CEREBRAS_MIN_GAP_MS || 2000),
  aiLearningJobCron: process.env.AI_LEARNING_JOB_CRON || '*/5 * * * *',
  aiLearningJobBatchSize: Number(process.env.AI_LEARNING_JOB_BATCH_SIZE || 1),
  oddsApiKey: process.env.ODDS_API_KEY || '',
  oddsApiSport: process.env.ODDS_API_SPORT || 'soccer_fifa_world_cup',
  apiFootballKey: process.env.API_FOOTBALL_KEY || '',
  apiFootballUrl: process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io',
  apiFootballSeason: process.env.API_FOOTBALL_SEASON || '2026',
  liveStreamEnabled: process.env.LIVE_STREAM_ENABLED !== 'false',
  fptBaseUrl: (
    process.env.FPT_BASE_URL ||
    process.env.LA18HD_BASE_URL ||
    'https://futbolparatodos.su'
  ).replace(/\/$/, ''),
  fptScraperEnabled:
    process.env.FPT_SCRAPER_ENABLED !== undefined
      ? process.env.FPT_SCRAPER_ENABLED !== 'false'
      : process.env.LA18HD_SCRAPER_ENABLED !== undefined
        ? process.env.LA18HD_SCRAPER_ENABLED === 'true'
        : process.env.LIVE_STREAM_ENABLED !== 'false',
  liveStreamUrls: {
    'fubo-youtube': process.env.LIVE_STREAM_URL_FUBO_YOUTUBE || '',
    'fubo-web': process.env.LIVE_STREAM_URL_FUBO_WEB || '',
    'fubo-app': process.env.LIVE_STREAM_URL_FUBO_APP || '',
    'fubo-roku': process.env.LIVE_STREAM_URL_FUBO_ROKU || '',
    'fubo-tubi': process.env.LIVE_STREAM_URL_FUBO_TUBI || '',
    'fubo-samsung': process.env.LIVE_STREAM_URL_FUBO_SAMSUNG || '',
    'fubo-sling': process.env.LIVE_STREAM_URL_FUBO_SLING || '',
    'fubo-prime': process.env.LIVE_STREAM_URL_FUBO_PRIME || '',
    'fubo-plex': process.env.LIVE_STREAM_URL_FUBO_PLEX || '',
    'fubo-lg': process.env.LIVE_STREAM_URL_FUBO_LG || '',
    'fubo-vizio': process.env.LIVE_STREAM_URL_FUBO_VIZIO || '',
    'fubo-tcl': process.env.LIVE_STREAM_URL_FUBO_TCL || '',
    'fubo-tablo': process.env.LIVE_STREAM_URL_FUBO_TABLO || '',
  },
  pushNotificationsEnabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@mundial2026.local',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  appPublicName: process.env.APP_PUBLIC_NAME || 'Mundial 2026',
  /** Base para caricaturas en producción (Heroku no incluye imagenes-jugadores en el slug). */
  playerPhotosGithubBase:
    process.env.PLAYER_PHOTOS_GITHUB_BASE ||
    'https://raw.githubusercontent.com/GyGSol/mundial2026/main/imagenes-jugadores',
  backupEnabled: process.env.BACKUP_ENABLED === 'true',
  backupGithubToken: process.env.BACKUP_GITHUB_TOKEN || '',
  backupGithubRepo: process.env.BACKUP_GITHUB_REPO || '',
  backupGithubBranch: process.env.BACKUP_GITHUB_BRANCH || 'main',
  /** Presupuesto heap Heroku (Procfile usa 384 MB; no subir sin revisar RAM del dyno). */
  memoryHeapLimitMb: Number(process.env.MEMORY_HEAP_LIMIT_MB || 384),
  memorySoftPressureRatio: Number(process.env.MEMORY_SOFT_PRESSURE_RATIO || 0.8),
  memoryHardPressureRatio: Number(process.env.MEMORY_HARD_PRESSURE_RATIO || 0.9),
  memoryHeadroomMaxWaitMs: Number(process.env.MEMORY_HEADROOM_MAX_WAIT_MS || 30_000),
};

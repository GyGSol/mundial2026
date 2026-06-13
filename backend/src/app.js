import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { requestTimingMiddleware } from './middleware/requestTiming.middleware.js';
import authRoutes from './routes/auth.routes.js';
import matchesRoutes from './routes/matches.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import predictionsRoutes from './routes/predictions.routes.js';
import aiConsultationsRoutes from './routes/aiConsultations.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import competitionGroupsRoutes from './routes/competitionGroups.routes.js';
import healthRoutes from './routes/health.routes.js';
import worldCupRoutes from './routes/worldCup.routes.js';
import simulationRoutes from './routes/simulation.routes.js';
import adminRoutes from './routes/admin.routes.js';
import playersRoutes from './routes/players.routes.js';
import streamRoutes from './routes/stream.routes.js';
import pushRoutes from './routes/push.routes.js';
import transmissionsRoutes from './routes/transmissions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(requestTimingMiddleware);
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/matches', matchesRoutes);
  app.use('/api', teamsRoutes);
  app.use('/api/predictions', predictionsRoutes);
  app.use('/api/ai-consultations', aiConsultationsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/competition-groups', competitionGroupsRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/world-cup', worldCupRoutes);
  app.use('/api/simulation', simulationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/players', playersRoutes);
  app.use('/api/stream-config', streamRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/transmissions', transmissionsRoutes);

  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(publicDir, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

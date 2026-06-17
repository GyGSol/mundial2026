import { getAiUser } from '../services/aiPredictionService.js';
import { env } from '../config/env.js';

/** Solo el usuario Predictive Modeling (isAiUser) o llamadas internas con secret. */
export async function predictiveModelingAuth(req, res, next) {
  try {
    const internalSecret = req.headers['x-oracle-internal-secret'];
    if (
      env.oracleInternalSecret &&
      internalSecret &&
      internalSecret === env.oracleInternalSecret
    ) {
      req.oracleInternal = true;
      return next();
    }

    const user = req.user;
    if (!user?.isAiUser) {
      return res.status(403).json({ error: 'Oracle reservado a Predictive Modeling' });
    }

    const aiUser = await getAiUser();
    if (!aiUser || String(user._id) !== String(aiUser._id)) {
      return res.status(403).json({ error: 'Oracle reservado a Predictive Modeling' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function oracleInternalAuth(req, res, next) {
  const internalSecret = req.headers['x-oracle-internal-secret'];
  if (!env.oracleInternalSecret || internalSecret !== env.oracleInternalSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.oracleInternal = true;
  next();
}

import { User } from '../models/User.js';
import { env } from '../config/env.js';

/** Usuario competidor IA (Predictive Modeling). Prioriza flag isAiUser. */
export async function getAiUser() {
  const marked = await User.findOne({ isAiUser: true });
  if (marked) return marked;

  const email = env.aiUserEmail;
  if (!email) return null;
  return User.findOne({ email, isAiUser: true });
}

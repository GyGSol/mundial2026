import { User } from '../models/User.js';
import { env } from '../config/env.js';
import {
  AI_USER_DISPLAY_NAME,
  AI_USER_LEGACY_DISPLAY_NAMES,
} from '../constants/aiUser.js';

function aiUserNameMatchers() {
  return [AI_USER_DISPLAY_NAME, ...AI_USER_LEGACY_DISPLAY_NAMES].map(
    (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  );
}

/** Usuario competidor IA (Futbot). Prioriza flag isAiUser. */
export async function getAiUser() {
  const marked = await User.findOne({ isAiUser: true });
  if (marked) return marked;

  const email = env.aiUserEmail;
  if (email) {
    const byEmail = await User.findOne({ email, isAiUser: true });
    if (byEmail) return byEmail;
  }

  const nameMatchers = aiUserNameMatchers();
  if (nameMatchers.length) {
    return User.findOne({
      $or: nameMatchers.map((pattern) => ({ name: pattern })),
    });
  }

  return null;
}

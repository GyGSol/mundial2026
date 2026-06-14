import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { revokeAllUserSessions } from './sessionService.js';
import { sendPasswordResetEmail } from './emailService.js';

export const MIN_USER_PASSWORD_LENGTH = 8;
export const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  'Si el email está registrado, te enviamos una clave provisoria. Revisá tu bandeja (y spam).';

export function generateTemporaryPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw createHttpError('El email es obligatorio', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.isAiUser) {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  const temporaryPassword = generateTemporaryPassword();
  user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
  user.mustChangePassword = true;
  user.passwordResetAt = new Date();
  await user.save();
  await revokeAllUserSessions(user._id);

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    temporaryPassword,
  });

  return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
}

export async function changeUserPassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) {
    throw createHttpError('Usuario no encontrado', 404);
  }

  const current = String(currentPassword ?? '');
  const next = String(newPassword ?? '');

  if (!current || !next) {
    throw createHttpError('La contraseña actual y la nueva son obligatorias', 400);
  }

  if (next.length < MIN_USER_PASSWORD_LENGTH) {
    throw createHttpError(
      `La contraseña debe tener al menos ${MIN_USER_PASSWORD_LENGTH} caracteres`,
      400
    );
  }

  if (
    user.mustChangePassword &&
    user.passwordResetAt &&
    Date.now() - user.passwordResetAt.getTime() > TEMP_PASSWORD_TTL_MS
  ) {
    throw createHttpError(
      'La clave provisoria expiró. Solicitá una nueva desde "Olvidé mi contraseña".',
      400
    );
  }

  const validCurrent = await bcrypt.compare(current, user.passwordHash);
  if (!validCurrent) {
    throw createHttpError('La contraseña actual no es correcta', 401);
  }

  if (current === next) {
    throw createHttpError('La nueva contraseña debe ser distinta a la actual', 400);
  }

  user.passwordHash = await bcrypt.hash(next, 10);
  user.mustChangePassword = false;
  user.passwordResetAt = null;
  await user.save();

  return user;
}

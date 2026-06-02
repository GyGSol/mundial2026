import bcrypt from 'bcryptjs';
import { AdminSettings } from '../models/AdminSettings.js';
import { env } from '../config/env.js';

const SETTINGS_KEY = 'admin';
const MIN_PASSWORD_LENGTH = 8;

export function isAdminConfiguredFromEnv() {
  return Boolean(env.adminUsername && env.adminPassword);
}

export async function isAdminConfigured() {
  if (isAdminConfiguredFromEnv()) return true;
  const doc = await AdminSettings.findOne({ key: SETTINGS_KEY }).lean();
  return Boolean(doc?.username && doc?.passwordHash);
}

export async function getAdminSetupStatus() {
  if (isAdminConfiguredFromEnv()) {
    return {
      configured: true,
      source: 'env',
      username: env.adminUsername,
    };
  }

  const doc = await AdminSettings.findOne({ key: SETTINGS_KEY }).select('username').lean();
  return {
    configured: Boolean(doc),
    source: doc ? 'database' : null,
    username: doc?.username ?? null,
  };
}

export async function setupAdminAccount({ username, password }) {
  if (await isAdminConfigured()) {
    const error = new Error('El administrador ya está configurado');
    error.status = 409;
    throw error;
  }

  const trimmedUsername = String(username ?? '').trim();
  const plainPassword = String(password ?? '');

  if (!trimmedUsername || trimmedUsername.length < 3) {
    const error = new Error('El usuario debe tener al menos 3 caracteres');
    error.status = 400;
    throw error;
  }

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    const error = new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  try {
    await AdminSettings.create({
      key: SETTINGS_KEY,
      username: trimmedUsername,
      passwordHash,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const error = new Error('El administrador ya está configurado');
      error.status = 409;
      throw error;
    }
    throw err;
  }

  return { username: trimmedUsername };
}

export async function verifyStoredAdminCredentials(username, password) {
  const doc = await AdminSettings.findOne({ key: SETTINGS_KEY });
  if (!doc) return false;
  if (username !== doc.username) return false;
  return bcrypt.compare(String(password), doc.passwordHash);
}

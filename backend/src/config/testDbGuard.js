/**
 * Evita que tests o restores borren la base de producción por error (p. ej. MONGODB_URI exportada desde Heroku).
 */
export const PRODUCTION_URI_MARKERS = ['elalzc2.mongodb.net', 'mundial2026.elalzc2'];

export const LOCAL_QA_DATABASE = 'mundial2026_local';
export const LOCAL_QA_URI = `mongodb://127.0.0.1:27017/${LOCAL_QA_DATABASE}`;

export function isProductionMongoUri(uri) {
  const lower = String(uri || '').toLowerCase();
  if (PRODUCTION_URI_MARKERS.some((marker) => lower.includes(marker))) {
    return true;
  }
  if (lower.includes('mongodb.net') || lower.includes('mongodb+srv')) {
    return true;
  }
  return false;
}

export function isLocalMongoUri(uri) {
  const lower = String(uri || '').toLowerCase();
  return lower.includes('127.0.0.1') || lower.includes('localhost');
}

export function parseDatabaseName(uri) {
  const withoutQuery = String(uri || '').split('?')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
}

export function assertSafeTestDatabase(uri = process.env.MONGODB_URI) {
  const resolved = uri || 'mongodb://127.0.0.1:27017/mundial2026_test';

  if (process.env.ALLOW_PRODUCTION_TEST_DB === '1') {
    return resolved;
  }

  if (isProductionMongoUri(resolved)) {
    throw new Error(
      `REFUSING to run tests against production MongoDB (${resolved}). ` +
        'Unset MONGODB_URI or use mongodb://127.0.0.1:27017/mundial2026_test. ' +
        'Set ALLOW_PRODUCTION_TEST_DB=1 only for deliberate disaster drills.'
    );
  }

  const lower = resolved.toLowerCase();
  if (!lower.includes('test') && !isLocalMongoUri(resolved)) {
    throw new Error(
      `REFUSING to run destructive tests against non-test database: ${resolved}. ` +
        'Use a URI that contains "test" or points to localhost.'
    );
  }

  return resolved;
}

export function assertSafeRestoreTarget(uri = process.env.MONGODB_URI) {
  const resolved = String(uri || '').trim();
  if (!resolved) {
    throw new Error('MONGODB_URI is required for restore.');
  }

  if (isProductionMongoUri(resolved) && process.env.ALLOW_PRODUCTION_RESTORE !== '1') {
    throw new Error(
      `REFUSING restore to production/Atlas MongoDB (${resolved}). ` +
        `Use localhost, e.g. ${LOCAL_QA_URI}. ` +
        'Set ALLOW_PRODUCTION_RESTORE=1 only for deliberate disaster recovery.'
    );
  }

  if (!isLocalMongoUri(resolved)) {
    throw new Error(
      `REFUSING restore to non-local database: ${resolved}. ` +
        `Use ${LOCAL_QA_URI} or another localhost URI.`
    );
  }

  return resolved;
}

export function getTestMongoUri() {
  return assertSafeTestDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test');
}

/**
 * Evita que tests borren la base de producción por error (p. ej. MONGODB_URI exportada desde Heroku).
 */
const PRODUCTION_URI_MARKERS = ['elalzc2.mongodb.net', 'mundial2026.elalzc2'];

export function assertSafeTestDatabase(uri = process.env.MONGODB_URI) {
  const resolved = uri || 'mongodb://127.0.0.1:27017/mundial2026_test';

  if (process.env.ALLOW_PRODUCTION_TEST_DB === '1') {
    return resolved;
  }

  const lower = resolved.toLowerCase();
  for (const marker of PRODUCTION_URI_MARKERS) {
    if (lower.includes(marker)) {
      throw new Error(
        `REFUSING to run tests against production MongoDB (${marker}). ` +
          'Unset MONGODB_URI or use mongodb://127.0.0.1:27017/mundial2026_test. ' +
          'Set ALLOW_PRODUCTION_TEST_DB=1 only for deliberate disaster drills.'
      );
    }
  }

  if (!lower.includes('test') && !lower.includes('127.0.0.1') && !lower.includes('localhost')) {
    throw new Error(
      `REFUSING to run destructive tests against non-test database: ${resolved}. ` +
        'Use a URI that contains "test" or points to localhost.'
    );
  }

  return resolved;
}

export function getTestMongoUri() {
  return assertSafeTestDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test');
}

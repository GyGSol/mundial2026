#!/usr/bin/env node
/**
 * Baseline timing for /predictions hot-path API endpoints.
 * Usage: BASE_URL=http://localhost:5000 TOKEN=... node scripts/measure-predictions-load.mjs
 */
const baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const token = process.env.TOKEN || '';

const headers = {
  Accept: 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function timedFetch(label, path) {
  const start = performance.now();
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const elapsed = performance.now() - start;
  const responseTime = res.headers.get('x-response-time');
  const ok = res.ok ? 'ok' : `ERR ${res.status}`;
  console.log(
    `${label.padEnd(36)} ${elapsed.toFixed(0).padStart(5)}ms  (${ok}${responseTime ? `, server ${responseTime}` : ''})`
  );
  if (!res.ok) {
    const body = await res.text();
    console.log(`  ${body.slice(0, 120)}`);
  }
  return elapsed;
}

console.log(`Base URL: ${baseUrl}`);
console.log('—'.repeat(58));

await timedFetch('GET /api/auth/me', '/api/auth/me');
await timedFetch('GET /api/matches (light)', '/api/matches');
await timedFetch('GET /api/matches?full=1 (legacy)', '/api/matches?full=1');
await timedFetch('GET /api/predictions/matches', '/api/predictions/matches');
await timedFetch('GET /api/predictions/group-standings', '/api/predictions/group-standings');

console.log('—'.repeat(58));
console.log('Target: /predictions/matches faster than /matches?full=1');

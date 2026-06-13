#!/usr/bin/env node
/**
 * Baseline timing for ranking hot-path API endpoints.
 * Usage: BASE_URL=http://localhost:5000 TOKEN=... node scripts/measure-ranking-load.mjs
 */
const baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const token = process.env.TOKEN || '';
const groupId = process.env.GROUP_ID || '__nogroup';

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
    `${label.padEnd(28)} ${elapsed.toFixed(0).padStart(5)}ms  (${ok}${responseTime ? `, server ${responseTime}` : ''})`
  );
  if (!res.ok) {
    const body = await res.text();
    console.log(`  ${body.slice(0, 120)}`);
  }
  return elapsed;
}

console.log(`Base URL: ${baseUrl}`);
console.log(`Group: ${groupId}`);
console.log('—'.repeat(52));

await timedFetch('GET /api/auth/me', '/api/auth/me');
await timedFetch('GET /api/competition-groups/my', '/api/competition-groups/my');
await timedFetch('GET /api/leaderboard', `/api/leaderboard?groupId=${encodeURIComponent(groupId)}`);
await timedFetch('GET /api/matches?status=live', '/api/matches?status=live');
await timedFetch('GET /api/matches?status=finished', '/api/matches?status=finished');
await timedFetch('GET /api/matches?status=upcoming', '/api/matches?status=upcoming');
await timedFetch(
  'GET /api/leaderboard/dashboard',
  `/api/leaderboard/dashboard?groupId=${encodeURIComponent(groupId)}`
);

console.log('—'.repeat(52));
console.log('Compare legacy 4-call path vs single /leaderboard/dashboard');

import { formatRequestError } from '../lib/apiError.js';

const ADMIN_API_BASE = '/api/admin';

async function adminRequest(path, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${ADMIN_API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(formatRequestError(err, null, {}));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatRequestError(null, res, data));
  }

  return data;
}

async function simulationRequest(path, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`/api/simulation${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(formatRequestError(err, null, {}));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatRequestError(null, res, data));
  }

  return data;
}

async function publicAdminRequest(path, options = {}) {
  let res;
  try {
    res = await fetch(`${ADMIN_API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error(formatRequestError(err, null, {}));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatRequestError(null, res, data));
  }

  return data;
}

export const adminAuthApi = {
  setupStatus: () => publicAdminRequest('/setup/status'),
  setup: (username, password, confirmPassword) =>
    publicAdminRequest('/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword }),
    }),
  login: (username, password) =>
    publicAdminRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => adminRequest('/me'),
  logout: () => adminRequest('/logout', { method: 'POST' }),
};

export const adminApi = {
  stats: () => adminRequest('/stats'),
  syncStatus: () => adminRequest('/sync'),
  runSync: () => adminRequest('/sync/run', { method: 'POST' }),
  runPlayerSync: () => adminRequest('/sync/players', { method: 'POST' }),
  listUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/users${query ? `?${query}` : ''}`);
  },
  getUser: (id) => adminRequest(`/users/${id}`),
  createUser: (body) =>
    adminRequest('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUser: (id, body) =>
    adminRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateUserPoints: (id, totalPoints) =>
    adminRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ totalPoints }),
    }),
  updateUserPassword: (id, password) =>
    adminRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),
  deleteUser: (id) => adminRequest(`/users/${id}`, { method: 'DELETE' }),
  listGroups: () => adminRequest('/groups'),
  getGroup: (id) => adminRequest(`/groups/${id}`),
  createGroup: (body) =>
    adminRequest('/groups', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateGroup: (id, body) =>
    adminRequest(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getGroupMembers: (id) => adminRequest(`/groups/${id}/members`),
  addGroupMember: (id, body) =>
    adminRequest(`/groups/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeGroupMember: (groupId, userId) =>
    adminRequest(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  updateGroupMemberRole: (groupId, userId, role) =>
    adminRequest(`/groups/${groupId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  listJoinRequests: (id) => adminRequest(`/groups/${id}/join-requests`),
  approveJoinRequest: (groupId, userId) =>
    adminRequest(`/groups/${groupId}/join-requests/${userId}/approve`, {
      method: 'POST',
    }),
  rejectJoinRequest: (groupId, userId) =>
    adminRequest(`/groups/${groupId}/join-requests/${userId}/reject`, {
      method: 'POST',
    }),
  deleteGroup: (id) => adminRequest(`/groups/${id}`, { method: 'DELETE' }),
  listMatches: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/matches${query ? `?${query}` : ''}`);
  },
  updateMatch: (id, body) =>
    adminRequest(`/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  recalculateMatch: (id) =>
    adminRequest(`/matches/${id}/recalculate`, { method: 'POST' }),
  recalculateAllMatches: () =>
    adminRequest('/matches/recalculate-all', { method: 'POST' }),
  listPredictions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/predictions${query ? `?${query}` : ''}`);
  },
  predictionDiagnostics: (matchNumber) =>
    adminRequest(`/predictions/diagnostics?matchNumber=${encodeURIComponent(matchNumber)}`),
  createPrediction: (body) =>
    adminRequest('/predictions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updatePrediction: (id, body) =>
    adminRequest(`/predictions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deletePrediction: (id) => adminRequest(`/predictions/${id}`, { method: 'DELETE' }),
  listAiCompetitorLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/ai-competitor/logs${query ? `?${query}` : ''}`);
  },
  getAiCompetitorOverview: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/ai-competitor/overview${query ? `?${query}` : ''}`);
  },
  simulateAiCompetitorPrediction: (matchId) =>
    adminRequest(`/ai-competitor/simulate/${encodeURIComponent(matchId)}`, {
      method: 'POST',
    }),
  upsertAiCompetitorPrediction: (matchId, body) =>
    adminRequest(`/ai-competitor/prediction/${encodeURIComponent(matchId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  runOfficialAiCompetitorPrediction: (matchId) =>
    adminRequest(`/ai-competitor/run-official/${encodeURIComponent(matchId)}`, {
      method: 'POST',
    }),
  getAiCompetitorLog: (id) => adminRequest(`/ai-competitor/logs/${encodeURIComponent(id)}`),
  updateAiCompetitorLogNotes: (id, adminNotes) =>
    adminRequest(`/ai-competitor/logs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes }),
    }),
  listStreamLinks: () => adminRequest('/stream-links'),
  suggestStreamLinks: (matchId) =>
    adminRequest(`/stream-links/suggest?matchId=${encodeURIComponent(matchId)}`),
  upsertStreamLink: (matchExternalId, body) =>
    adminRequest(`/stream-links/${encodeURIComponent(matchExternalId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteStreamLink: (matchExternalId) =>
    adminRequest(`/stream-links/${encodeURIComponent(matchExternalId)}`, { method: 'DELETE' }),
  listTodayTransmissions: () => adminRequest('/transmissions/today'),
  getEconomyOverview: () => adminRequest('/economy/overview'),
  getEconomyGroup: (groupId) => adminRequest(`/economy/groups/${encodeURIComponent(groupId)}`),
};

export const adminSimulationApi = {
  status: () => simulationRequest('/'),
  setup: (body = {}) =>
    simulationRequest('/setup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  live: () => simulationRequest('/live', { method: 'POST' }),
  finish: () => simulationRequest('/finish', { method: 'POST' }),
  reset: () => simulationRequest('/', { method: 'DELETE' }),
};

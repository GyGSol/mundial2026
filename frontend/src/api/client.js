import { formatRequestError } from '../lib/apiError.js';
import { clearStoredSession, getStoredToken } from '../lib/sessionStorage.js';

const API_BASE = '/api';

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(formatRequestError(err, null, {}));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      clearStoredSession();
    }
    throw new Error(formatRequestError(null, res, data));
  }

  return data;
}

export const authApi = {
  register: (name, email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (name) =>
    request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
};

export const competitionGroupsApi = {
  list: () => request('/competition-groups'),
  my: () => request('/competition-groups/my'),
  create: (name, description = '', prizesWinnersCount = 0, prizes = []) =>
    request('/competition-groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, prizesWinnersCount, prizes }),
    }),
  join: (groupId) =>
    request(`/competition-groups/${groupId}/join`, {
      method: 'POST',
    }),
  requestJoin: (groupId) =>
    request(`/competition-groups/${groupId}/join-request`, {
      method: 'POST',
    }),
  myJoinRequests: () => request('/competition-groups/my/join-requests'),
  pendingApprovalCount: () => request('/competition-groups/my/pending-approval-count'),
  listJoinRequests: (groupId) => request(`/competition-groups/${groupId}/join-requests`),
  approveJoinRequest: (groupId, userId) =>
    request(`/competition-groups/${groupId}/join-requests/${userId}/approve`, {
      method: 'POST',
    }),
  rejectJoinRequest: (groupId, userId) =>
    request(`/competition-groups/${groupId}/join-requests/${userId}/reject`, {
      method: 'POST',
    }),
  removeMember: (groupId, userId) =>
    request(`/competition-groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    }),
  leave: (groupId) =>
    request(`/competition-groups/${groupId}/leave`, {
      method: 'POST',
    }),
  members: (groupId) => request(`/competition-groups/${groupId}/members`),
  invitePreview: (groupId) => request(`/competition-groups/${groupId}/invite`),
  update: (groupId, name, description = '', prizesWinnersCount = 0, prizes = []) =>
    request(`/competition-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, prizesWinnersCount, prizes }),
    }),
  setActive: (groupId) =>
    request('/competition-groups/active', {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    }),
  remove: (groupId) =>
    request(`/competition-groups/${groupId}`, {
      method: 'DELETE',
    }),
};

export const matchesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/matches${query ? `?${query}` : ''}`);
  },
  listFull: (params = {}) => {
    const query = new URLSearchParams({ ...params, full: '1' }).toString();
    return request(`/matches?${query}`);
  },
};

export const aiConsultationsApi = {
  listThreads: () => request('/ai-consultations'),
  getThread: (topicType, topicKey) => {
    const params = new URLSearchParams({ topicType, topicKey });
    return request(`/ai-consultations/thread?${params}`);
  },
  generateInsight: (matchId) =>
    request('/ai-consultations/insight', {
      method: 'POST',
      body: JSON.stringify({ matchId }),
    }),
  ask: (body) =>
    request('/ai-consultations/ask', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const predictionsApi = {
  save: (matchId, homeGoals, awayGoals) =>
    request(`/predictions/${matchId}`, {
      method: 'PUT',
      body: JSON.stringify({ homeGoals, awayGoals }),
    }),
  aiInsight: (matchId) =>
    request(`/predictions/${matchId}/ai-insight`, {
      method: 'POST',
    }),
  aiFollowUp: (matchId, body) =>
    request(`/predictions/${matchId}/ai-follow-up`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  groupStandings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/predictions/group-standings${query ? `?${query}` : ''}`);
  },
};

export const leaderboardApi = {
  list: (groupId) => {
    const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return request(`/leaderboard${query}`);
  },
  dashboard: (groupId) =>
    request(`/leaderboard/dashboard?groupId=${encodeURIComponent(groupId)}`),
};

export const teamsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/teams${query ? `?${query}` : ''}`);
  },
};

export const playersApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/players${query ? `?${query}` : ''}`);
  },
  get: (id) => request(`/players/${id}`),
  meta: () => request('/players/meta'),
  refreshTeamIntel: (team, { force = false } = {}) =>
    request('/players/ai/refresh-team', {
      method: 'POST',
      body: JSON.stringify({ team, force }),
    }),
  refreshPlayerIntel: (id) =>
    request(`/players/${id}/ai/refresh`, {
      method: 'POST',
    }),
  askPlayerIntel: (id, question) =>
    request(`/players/${id}/ai/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};

export const healthApi = {
  get: () => request('/health'),
};

export const worldCupApi = {
  overview: (groupId) => {
    const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return request(`/world-cup${query}`);
  },
  history: () => request('/world-cup/history'),
  aiBriefing: () => request('/world-cup/ai-briefing'),
  refreshAiBriefing: () =>
    request('/world-cup/ai-briefing/refresh', {
      method: 'POST',
    }),
};

export const simulationApi = {
  status: () => request('/simulation'),
  setup: (body = {}) =>
    request('/simulation/setup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  live: () =>
    request('/simulation/live', {
      method: 'POST',
    }),
  finish: () =>
    request('/simulation/finish', {
      method: 'POST',
    }),
  reset: () =>
    request('/simulation', {
      method: 'DELETE',
    }),
};

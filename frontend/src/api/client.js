import { formatRequestError } from '../lib/apiError.js';
import { clearStoredSession, getStoredToken } from '../lib/sessionStorage.js';

const API_BASE = '/api';

export async function request(path, options = {}) {
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
    if (
      res.status === 401 &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/register') &&
      !path.startsWith('/auth/forgot-password')
    ) {
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
  updateProfile: ({ name, avatarDataUrl } = {}) =>
    request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, avatarDataUrl }),
    }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const competitionGroupsApi = {
  list: () => request('/competition-groups'),
  dashboard: () => request('/competition-groups/dashboard'),
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
  tournamentEnrollments: {
    list: (groupId) => request(`/competition-groups/${groupId}/tournament-enrollments`),
    enroll: (groupId, tournamentType) =>
      request(`/competition-groups/${groupId}/tournament-enrollments`, {
        method: 'POST',
        body: JSON.stringify({ tournamentType }),
      }),
  },
  eliminationTournament: {
    get: (groupId) => request(`/competition-groups/${groupId}/elimination-tournament`),
    activate: (groupId) =>
      request(`/competition-groups/${groupId}/elimination-tournament/activate`, {
        method: 'POST',
      }),
    start: (groupId) =>
      request(`/competition-groups/${groupId}/elimination-tournament/start`, {
        method: 'POST',
      }),
  },
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
  getById: (matchId) => request(`/matches/${encodeURIComponent(matchId)}`),
  liveSnapshot: () => request('/matches/live-snapshot'),
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
  clearConversation: (body) =>
    request('/ai-consultations/clear-conversation', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const predictionsApi = {
  listMatches: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/predictions/matches${query ? `?${query}` : ''}`);
  },
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
  pointsEvolution: (groupId) =>
    request(`/leaderboard/${encodeURIComponent(groupId)}/points-evolution`),
  finishedArchive: () => request('/leaderboard/finished-archive'),
};

export const teamsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/teams${query ? `?${query}` : ''}`);
  },
  getKit: async (fifaCode) => {
    const code = String(fifaCode ?? '').trim().toUpperCase();
    if (!code) return null;

    const token = getStoredToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let res;
    try {
      res = await fetch(`${API_BASE}/teams/${encodeURIComponent(code)}/kit`, { headers });
    } catch {
      return null;
    }

    if (res.status === 404) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return data;
  },
  coachWiki: ({ name, fifaCode, teamName } = {}) => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (fifaCode) params.set('fifaCode', fifaCode);
    if (teamName) params.set('teamName', teamName);
    const query = params.toString();
    return request(`/teams/coach-wiki${query ? `?${query}` : ''}`);
  },
};

export const playersApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/players${query ? `?${query}` : ''}`);
  },
  get: (id) => request(`/players/${id}`),
  getByExternal: (externalId) =>
    request(`/players/by-external/${encodeURIComponent(externalId)}`),
  getTournamentActivity: ({ playerId, externalId, name, team } = {}) => {
    const params = new URLSearchParams();
    if (playerId) params.set('playerId', playerId);
    if (externalId) params.set('externalId', externalId);
    if (name) params.set('name', name);
    if (team) params.set('team', team);
    const query = params.toString();
    return request(`/players/tournament-activity${query ? `?${query}` : ''}`);
  },
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
  overview: ({ playerStats = false } = {}) => {
    const params = new URLSearchParams();
    if (playerStats) params.set('playerStats', '1');
    const query = params.toString();
    return request(`/world-cup${query ? `?${query}` : ''}`);
  },
  history: () => request('/world-cup/history'),
  dataCenter: ({ nation } = {}) => {
    const params = new URLSearchParams();
    if (nation) params.set('nation', nation);
    const query = params.toString();
    return request(`/world-cup/data-center${query ? `?${query}` : ''}`);
  },
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

export const pushApi = {
  getVapidPublicKey: () => request('/push/vapid-public-key'),
  getPreferences: () => request('/push/preferences'),
  updatePreferences: (preferences) =>
    request('/push/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),
  subscribe: (subscription) =>
    request('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),
};

export const streamApi = {
  getConfig: async (matchId, channelId) => {
    const params = new URLSearchParams({ matchId: String(matchId) });
    if (channelId) params.set('channelId', channelId);
    const path = `/stream-config?${params}`;

    const token = getStoredToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { headers });
    } catch (err) {
      throw new Error(formatRequestError(err, null, {}));
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 400) return data;
    if (!res.ok) {
      throw new Error(formatRequestError(null, res, data));
    }
    return data;
  },
};

export const matchStreamApi = {
  getStream: (matchId, { sourceId } = {}) => {
    const params = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
    return request(`/matches/${encodeURIComponent(matchId)}/stream${params}`);
  },
};

export const transmissionsApi = {
  today: () => request('/transmissions/today'),
};

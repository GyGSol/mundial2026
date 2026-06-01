const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
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
};

export const predictionsApi = {
  save: (matchId, homeGoals, awayGoals) =>
    request(`/predictions/${matchId}`, {
      method: 'PUT',
      body: JSON.stringify({ homeGoals, awayGoals }),
    }),
};

export const leaderboardApi = {
  list: (groupId) => {
    const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return request(`/leaderboard${query}`);
  },
};

export const teamsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/teams${query ? `?${query}` : ''}`);
  },
};

export const healthApi = {
  get: () => request('/health'),
};

export const worldCupApi = {
  overview: (groupId) => {
    const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return request(`/world-cup${query}`);
  },
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

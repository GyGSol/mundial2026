import { request } from './client.js';

export const economyApi = {
  getBalance: () => request('/economy/balance'),
  getTransactions: ({ limit = 50, cursor } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return request(`/economy/transactions${qs ? `?${qs}` : ''}`);
  },
  startCheckout: (usdAmount) =>
    request('/economy/checkout', {
      method: 'POST',
      body: JSON.stringify({ usdAmount }),
    }),
  completeCheckout: (sessionId) =>
    request('/economy/webhook/mock', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
  withdraw: (amount) =>
    request('/economy/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

import api from './client.js';

export async function getLeaderboard(scope = 'all', ward) {
  const { data } = await api.get('/leaderboard', { params: { scope, ...(ward ? { ward } : {}) } });
  return data.data;
}

export async function getMyGamificationStats() {
  const { data } = await api.get('/users/me/stats');
  return data.data;
}

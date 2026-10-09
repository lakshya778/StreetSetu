import api from './client.js';

export async function getLeaderboard(scope = 'all', ward) {
  const { data } = await api.get('/leaderboard', { params: { scope, ...(ward ? { ward } : {}) } });
  return data.data;
}

export async function getMyGamificationStats() {
  const { data } = await api.get('/users/me/stats');
  return data.data;
}

export async function getMonthlyHighlights() {
  const { data } = await api.get('/gamification/top3');
  return data.data;
}

export async function getMyCertificates() {
  const { data } = await api.get('/users/me/certificates');
  return data.data;
}

export async function downloadMyCertificate(certificateId) {
  const { data } = await api.get(`/users/me/certificates/${certificateId}/download`, { responseType: 'blob' });
  return data;
}

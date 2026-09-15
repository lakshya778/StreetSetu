import api from './client.js';

export async function getNotifications(params = {}) {
  const { data } = await api.get('/notifications', { params });
  return data.data;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data;
}

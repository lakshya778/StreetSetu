import api from './client.js';

export async function getDrives() {
  const { data } = await api.get('/drives');
  return data.data;
}

export async function createDrive(payload) {
  const { data } = await api.post('/drives', payload);
  return data.data;
}

export async function joinDrive(id) {
  const { data } = await api.post(`/drives/${encodeURIComponent(id)}/join`);
  return data.data;
}

export async function leaveDrive(id) {
  const { data } = await api.post(`/drives/${encodeURIComponent(id)}/leave`);
  return data.data;
}

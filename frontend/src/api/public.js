import api from './client.js';

export async function getPublicTransparency() {
  const { data } = await api.get('/public/transparency');
  return data.data;
}

export async function getPublicComplaintTracking(complaintId) {
  const { data } = await api.get(`/public/complaints/${encodeURIComponent(complaintId)}`);
  return data.data;
}

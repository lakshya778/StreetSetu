import api from './client.js';

export const complaintCategories = [
  'roads',
  'street_lighting',
  'waste_management',
  'water_supply',
  'drainage',
  'public_safety',
  'parks',
  'sanitation',
  'other'
];

export const complaintPriorities = ['low', 'medium', 'high', 'critical'];

export async function getComplaints(params = {}) {
  const { data } = await api.get('/complaints', { params });
  return data.data;
}

export async function getComplaint(id) {
  const { data } = await api.get(`/complaints/${id}`);
  return data.data;
}

export async function createComplaint(payload) {
  const { data } = await api.post('/complaints', payload);
  return data.data;
}

export async function updateComplaintStatus(id, payload) {
  const { data } = await api.patch(`/complaints/${id}/status`, payload);
  return data.data;
}

export async function classifyComplaint(id) {
  const { data } = await api.post(`/ai/complaints/${id}/classify`);
  return data.data;
}

export async function uploadComplaintImages(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const { data } = await api.post('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.data.attachments;
}

export async function submitComplaintFeedback(id, payload) {
  const { data } = await api.post(`/complaints/${id}/feedback`, payload);
  return data.data;
}

export async function getNearbyComplaints({ latitude, longitude, radius = 1000, limit = 50 }) {
  const { data } = await api.get('/complaints/nearby', { params: { latitude, longitude, radius, limit } });
  return data.data;
}

export async function checkComplaintDuplicates(payload) {
  const { data } = await api.post('/complaints/duplicates/check', payload);
  return data.data;
}

export async function supportDuplicateComplaint(id) {
  const { data } = await api.post(`/complaints/${id}/support-duplicate`);
  return data.data;
}

export async function getDuplicateComplaints() {
  const { data } = await api.get('/complaints/duplicates');
  return data.data;
}

export async function mergeDuplicateComplaint(id, masterComplaintId) {
  const { data } = await api.post(`/complaints/${id}/merge`, { masterComplaintId });
  return data.data;
}

export async function uploadWorkEvidence(complaintId, stage, files) {
  if (!['before', 'after'].includes(stage)) throw new Error('Evidence stage must be before or after');
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const { data } = await api.post(`/uploads/complaints/${complaintId}/${stage}-images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.data.images;
}

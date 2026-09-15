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

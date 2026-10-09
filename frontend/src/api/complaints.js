import api from './client.js';
import { compressImageFile } from '../components/media/imageCompression.js';
import { getCurrentUserId } from '../auth/accessTokenStore.js';

const complaintListCache = new Map();
const complaintListRequests = new Map();
const COMPLAINT_LIST_STALE_MS = 30 * 1000;

export function complaintListCacheKey(params = {}) {
  return JSON.stringify([getCurrentUserId(), params]);
}

function dispatchComplaintListRefresh(key, data) {
  window.dispatchEvent(new CustomEvent('streetsetu:complaints-refreshed', { detail: { key, data } }));
}

async function fetchComplaintList(params, key) {
  const pending = complaintListRequests.get(key);
  if (pending) return pending;
  const request = api.get('/complaints', { params }).then(({ data }) => {
    complaintListCache.set(key, { data: data.data, updatedAt: Date.now() });
    while (complaintListCache.size > 50) complaintListCache.delete(complaintListCache.keys().next().value);
    dispatchComplaintListRefresh(key, data.data);
    return data.data;
  }).finally(() => complaintListRequests.delete(key));
  complaintListRequests.set(key, request);
  return request;
}

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
  const key = complaintListCacheKey(params);
  const cached = complaintListCache.get(key);
  if (cached) {
    if (Date.now() - cached.updatedAt >= COMPLAINT_LIST_STALE_MS) {
      void fetchComplaintList(params, key).catch((error) => {
        window.dispatchEvent(new CustomEvent('streetsetu:complaints-refresh-error', { detail: { key, error } }));
      });
    }
    return cached.data;
  }
  return fetchComplaintList(params, key);
}

export async function getComplaint(id) {
  const { data } = await api.get(`/complaints/${id}`);
  return data.data;
}

export async function createComplaint(payload) {
  const { data } = await api.post('/complaints', payload);
  complaintListCache.clear();
  return data.data;
}

export async function updateComplaintStatus(id, payload) {
  const { data } = await api.patch(`/complaints/${id}/status`, payload);
  complaintListCache.clear();
  return data.data;
}

export async function classifyComplaint(id) {
  const { data } = await api.post(`/ai/complaints/${id}/classify`);
  return data.data;
}

export async function uploadComplaintImages(photos, location, onUploadProgress) {
  const compressedFiles = await Promise.all(photos.map(({ file }) => compressImageFile(file)));
  const formData = new FormData();
  compressedFiles.forEach((file) => formData.append('images', file));
  formData.append('latitude', String(location.latitude));
  formData.append('longitude', String(location.longitude));
  formData.append('captureMetadata', JSON.stringify(photos.map(({ metadata }) => metadata)));
  const { data } = await api.post('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => onUploadProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0)
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
  complaintListCache.clear();
  return data.data;
}

export async function getDuplicateComplaints() {
  const { data } = await api.get('/complaints/duplicates');
  return data.data;
}

export async function mergeDuplicateComplaint(id, masterComplaintId) {
  const { data } = await api.post(`/complaints/${id}/merge`, { masterComplaintId });
  complaintListCache.clear();
  return data.data;
}

export async function uploadWorkEvidence(complaintId, stage, files, captureMetadata = {}, onUploadProgress) {
  if (!['before', 'after'].includes(stage)) throw new Error('Evidence stage must be before or after');
  const compressedFiles = await Promise.all(files.map(compressImageFile));
  const formData = new FormData();
  compressedFiles.forEach((file) => formData.append('images', file));
  if (stage === 'after') {
    Object.entries(captureMetadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, String(value));
    });
  }
  const { data } = await api.post(`/uploads/complaints/${complaintId}/${stage}-images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => onUploadProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0)
  });
  return data.data;
}

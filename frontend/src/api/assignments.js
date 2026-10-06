import api, { ensureAccessToken } from './client.js';

export async function getMyAssignments(params = {}) {
  const { data } = await api.get('/assignments/my-assignments', { params });
  return data.data;
}

export async function updateAssignedComplaintStatus(complaintId, payload) {
  const { data } = await api.patch(`/assignments/${complaintId}/status`, payload);
  return data.data;
}

export async function respondToAssignment(complaintId, response) {
  const { data } = await api.patch(`/assignments/${complaintId}/response`, { response });
  return data.data;
}

export async function assignComplaint(complaintId, volunteerId, { recommendationAccepted = false } = {}) {
  const { data } = await api.post(`/assignments/${complaintId}/assign`, { volunteerId, recommendationAccepted });
  return data.data;
}

export async function getVolunteerRecommendations(complaintId) {
  await ensureAccessToken();
  const { data } = await api.get(`/assignments/recommend/${complaintId}`, {
    streetsetuDiagnostic: 'volunteer-recommendations'
  });
  return data.data;
}

export async function getMyOptimizedRoute() {
  const { data } = await api.get('/assignments/my-route');
  return data.data;
}

export async function reassignComplaint(complaintId, volunteerId) {
  const { data } = await api.put(`/assignments/${complaintId}/reassign`, { volunteerId });
  return data.data;
}

export async function getCompletionVerification(complaintId) {
  const { data } = await api.get(`/assignments/completion-verifications/${complaintId}`);
  return data.data;
}

export async function getCompletionVerifications() {
  const { data } = await api.get('/assignments/completion-verifications');
  return data.data;
}

export async function reviewCompletionVerification(complaintId, decision) {
  const { data } = await api.patch(`/assignments/completion-verifications/${complaintId}`, { decision });
  return data.data;
}

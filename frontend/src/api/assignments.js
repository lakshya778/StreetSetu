import api from './client.js';

export async function getMyAssignments(params = {}) {
  const { data } = await api.get('/assignments/my-assignments', { params });
  return data.data;
}

export async function updateAssignedComplaintStatus(complaintId, payload) {
  const { data } = await api.patch(`/assignments/${complaintId}/status`, payload);
  return data.data;
}

export async function assignComplaint(complaintId, volunteerId) {
  const { data } = await api.post(`/assignments/${complaintId}/assign`, { volunteerId });
  return data.data;
}

export async function reassignComplaint(complaintId, volunteerId) {
  const { data } = await api.put(`/assignments/${complaintId}/reassign`, { volunteerId });
  return data.data;
}

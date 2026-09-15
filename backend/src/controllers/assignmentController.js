import {
  assignComplaint,
  listMyAssignments,
  reassignComplaint,
  updateAssignedStatus
} from '../services/assignmentService.js';

export async function assign(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await assignComplaint(req.params.complaintId, req.body.volunteerId, req), message: 'Complaint assigned successfully' });
  } catch (error) { return next(error); }
}

export async function reassign(req, res, next) {
  try {
    return res.json({ success: true, data: await reassignComplaint(req.params.complaintId, req.body.volunteerId, req), message: 'Complaint reassigned successfully' });
  } catch (error) { return next(error); }
}

export async function myAssignments(req, res, next) {
  try {
    return res.json({ success: true, data: await listMyAssignments(req.query, req) });
  } catch (error) { return next(error); }
}

export async function updateStatus(req, res, next) {
  try {
    return res.json({ success: true, data: await updateAssignedStatus(req.params.complaintId, req.body, req), message: 'Complaint status updated successfully' });
  } catch (error) { return next(error); }
}

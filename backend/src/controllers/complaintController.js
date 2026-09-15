import {
  createComplaint,
  getComplaint,
  listCategories,
  listComplaints,
  updateComplaintStatus
} from '../services/complaintService.js';

export async function create(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await createComplaint(req.body, req), message: 'Complaint created successfully' });
  } catch (error) { return next(error); }
}

export async function list(req, res, next) {
  try {
    return res.json({ success: true, data: await listComplaints(req.query, req) });
  } catch (error) { return next(error); }
}

export async function detail(req, res, next) {
  try {
    return res.json({ success: true, data: await getComplaint(req.params.id, req) });
  } catch (error) { return next(error); }
}

export async function updateStatus(req, res, next) {
  try {
    return res.json({ success: true, data: await updateComplaintStatus(req.params.id, req.body, req), message: 'Complaint status updated successfully' });
  } catch (error) { return next(error); }
}

export function categories(req, res) {
  return res.json({ success: true, data: listCategories() });
}

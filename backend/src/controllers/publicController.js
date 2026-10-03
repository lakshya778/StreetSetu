import { getPublicComplaintTracking, getPublicTransparencySummary } from '../services/publicTransparencyService.js';

export async function transparency(req, res, next) {
  try { return res.json({ success: true, data: await getPublicTransparencySummary(), message: 'Public transparency summary loaded' }); }
  catch (error) { return next(error); }
}

export async function trackComplaint(req, res, next) {
  try { return res.json({ success: true, data: await getPublicComplaintTracking(req.params.complaintId), message: 'Complaint tracking loaded' }); }
  catch (error) { return next(error); }
}

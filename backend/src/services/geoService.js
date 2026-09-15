import Complaint, { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../models/Complaint.js';

export async function findNearbyComplaints({ latitude, longitude, radiusMeters, limit }, req) {
  const filter = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: radiusMeters
      }
    }
  };

  if (req.user.role !== 'admin') {
    filter.$or = [{ createdBy: req.user.sub }, { assignedTo: req.user.sub }];
  }
  if (req.query.status && COMPLAINT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.category && COMPLAINT_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.priority && COMPLAINT_PRIORITIES.includes(req.query.priority)) filter.priority = req.query.priority;

  const items = await Complaint.find(filter)
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .limit(limit);

  return {
    items,
    count: items.length,
    center: { latitude, longitude },
    radiusMeters
  };
}
import Complaint, { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../models/Complaint.js';
import Vote from '../models/Vote.js';

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

export async function discoverNearbyComplaints({ latitude, longitude, radiusMeters, limit }) {
  const items = await Complaint.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        key: 'location',
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        spherical: true
      }
    },
    { $sort: { distanceMeters: 1 } },
    { $limit: limit },
    { $project: { title: 1, category: 1, status: 1, address: 1, distanceMeters: 1 } },
    {
      $lookup: {
        from: Vote.collection.name,
        let: { complaintId: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$complaint', '$$complaintId'] } } }, { $count: 'count' }],
        as: 'support'
      }
    },
    { $set: { supportCount: { $ifNull: [{ $arrayElemAt: ['$support.count', 0] }, 0] } } },
    { $unset: 'support' }
  ]);
  return { items, count: items.length, center: { latitude, longitude }, radiusMeters };
}

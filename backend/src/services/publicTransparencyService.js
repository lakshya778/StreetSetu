import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';

const RESOLVED = ['resolved', 'closed'];
const ACTIVE = ['submitted', 'under_review', 'assigned', 'in_progress'];

export async function getPublicTransparencySummary() {
  const [overviewRows, categories, areas, heatmapZones] = await Promise.all([
    Complaint.aggregate([
      { $group: {
        _id: null,
        totalComplaints: { $sum: 1 },
        resolvedComplaints: { $sum: { $cond: [{ $in: ['$status', RESOLVED] }, 1, 0] } },
        activeComplaints: { $sum: { $cond: [{ $in: ['$status', ACTIVE] }, 1, 0] } },
        rejectedComplaints: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        averageResolutionMs: { $avg: { $cond: [{ $and: [{ $in: ['$status', RESOLVED] }, { $ne: ['$resolvedAt', null] }] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } }
      } },
      { $project: { _id: 0, totalComplaints: 1, resolvedComplaints: 1, activeComplaints: 1, rejectedComplaints: 1, averageResolutionMs: 1 } }
    ]),
    Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }, { $limit: 6 },
      { $project: { _id: 0, category: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $set: { publicArea: { $cond: [
        { $gt: [{ $strLenCP: { $ifNull: ['$area', ''] } }, 0] },
        '$area',
        { $trim: { input: { $arrayElemAt: [{ $split: [{ $ifNull: ['$address', ''] }, ','] }, 0] } } }
      ] } } },
      { $group: { _id: '$publicArea', count: { $sum: 1 } } },
      { $match: { _id: { $nin: ['', null] } } },
      { $sort: { count: -1, _id: 1 } }, { $limit: 8 },
      { $project: { _id: 0, area: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $match: { 'location.type': 'Point', 'location.coordinates.0': { $exists: true }, 'location.coordinates.1': { $exists: true } } },
      { $group: { _id: { latitude: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 2] }, longitude: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 2] } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 },
      { $project: { _id: 0, latitude: '$_id.latitude', longitude: '$_id.longitude', count: 1 } }
    ])
  ]);
  const overview = overviewRows[0] || { totalComplaints: 0, resolvedComplaints: 0, activeComplaints: 0, rejectedComplaints: 0, averageResolutionMs: null };
  return {
    ...overview,
    resolutionRate: overview.totalComplaints ? Math.round((overview.resolvedComplaints / overview.totalComplaints) * 10000) / 100 : 0,
    averageResolutionDays: overview.averageResolutionMs == null ? null : Math.round((overview.averageResolutionMs / 86400000) * 10) / 10,
    topCategories: categories,
    mostActiveAreas: areas,
    heatmapSummary: heatmapZones
  };
}

export async function getPublicComplaintTracking(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Complaint was not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  const complaint = await Complaint.findById(id)
    .select('title category status createdAt updatedAt resolvedAt assignedVolunteer assignedTo statusHistory')
    .populate('assignedVolunteer', 'name')
    .populate('assignedTo', 'name')
    .lean();
  if (!complaint) {
    const error = new Error('Complaint was not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  const timeline = (complaint.statusHistory || []).map(({ eventType, status, previousStatus, changedAt }) => ({
    eventType, status, previousStatus, changedAt
  })).sort((left, right) => new Date(left.changedAt) - new Date(right.changedAt));
  const assignedVolunteer = complaint.assignedVolunteer || complaint.assignedTo;
  return {
    _id: complaint._id,
    title: complaint.title,
    category: complaint.category,
    status: complaint.status,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    resolvedAt: complaint.resolvedAt,
    assignedVolunteer: assignedVolunteer ? { name: assignedVolunteer.name } : null,
    timeline
  };
}

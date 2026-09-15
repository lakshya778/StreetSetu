import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';

const OPEN_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress'];
const RESOLVED_STATUSES = ['resolved', 'closed'];

function buildMatch(query, req) {
  const match = {};
  if (query.wardId) match.wardId = query.wardId;
  if (query.fromDate || query.toDate) {
    match.createdAt = {};
    if (query.fromDate) match.createdAt.$gte = query.fromDate;
    if (query.toDate) match.createdAt.$lte = query.toDate;
  }
  if (req.user.role === 'citizen') {
    match.createdBy = new mongoose.Types.ObjectId(req.user.sub);
  } else if (req.user.role === 'volunteer') {
    match.assignedTo = new mongoose.Types.ObjectId(req.user.sub);
  }
  return match;
}

function countByStatus(statuses) {
  return { $sum: { $cond: [{ $in: ['$status', statuses] }, 1, 0] } };
}

function calculateRate(resolved, total) {
  return total === 0 ? 0 : Math.round((resolved / total) * 10000) / 100;
}

export async function getDashboardSummary(query, req) {
  const match = buildMatch(query, req);
  const [totalComplaints, openComplaints, resolvedComplaints, categoryCounts, wardStatistics, volunteerGroups] = await Promise.all([
    Complaint.countDocuments(match),
    Complaint.countDocuments({ ...match, status: { $in: OPEN_STATUSES } }),
    Complaint.countDocuments({ ...match, status: { $in: RESOLVED_STATUSES } }),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$wardId',
          totalComplaints: { $sum: 1 },
          openComplaints: countByStatus(OPEN_STATUSES),
          resolvedComplaints: countByStatus(RESOLVED_STATUSES)
        }
      },
      { $sort: { totalComplaints: -1 } },
      {
        $project: {
          _id: 0,
          wardId: '$_id',
          totalComplaints: 1,
          openComplaints: 1,
          resolvedComplaints: 1
        }
      }
    ]),
    Complaint.aggregate([
      { $match: { ...match, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          assignedComplaints: { $sum: 1 },
          openComplaints: countByStatus(OPEN_STATUSES),
          resolvedComplaints: countByStatus(RESOLVED_STATUSES)
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'volunteer'
        }
      },
      { $unwind: { path: '$volunteer', preserveNullAndEmptyArrays: true } },
      { $match: { 'volunteer.role': 'volunteer' } },
      { $sort: { resolvedComplaints: -1, assignedComplaints: -1 } },
      {
        $project: {
          _id: 0,
          volunteerId: '$_id',
          volunteerName: '$volunteer.name',
          volunteerRole: '$volunteer.role',
          assignedComplaints: 1,
          openComplaints: 1,
          resolvedComplaints: 1
        }
      }
    ])
  ]);

  const wardStats = wardStatistics.map((ward) => ({
    ...ward,
    resolutionRate: calculateRate(ward.resolvedComplaints, ward.totalComplaints)
  }));
  const volunteerPerformance = volunteerGroups.map((volunteer) => ({
    ...volunteer,
    resolutionRate: calculateRate(volunteer.resolvedComplaints, volunteer.assignedComplaints)
  }));

  return {
    totalComplaints,
    openComplaints,
    resolvedComplaints,
    categoryCounts,
    wardStatistics: wardStats,
    volunteerPerformance,
    filters: {
      wardId: query.wardId || null,
      from: query.fromDate?.toISOString() || null,
      to: query.toDate?.toISOString() || null
    }
  };
}

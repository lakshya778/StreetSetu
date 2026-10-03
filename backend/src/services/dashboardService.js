import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import DuplicateSupport from '../models/DuplicateSupport.js';

const OPEN_STATUSES = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress'
];

const RESOLVED_STATUSES = [
  'resolved',
  'closed'
];

const REJECTED_STATUSES = [
  'rejected'
];

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
  const [
  totalComplaints,
  openComplaints,
  resolvedComplaints,
  rejectedComplaints,
  categoryCounts,
  topRejectionCategories,
  statusCounts,
  monthlyTrends,
  resolutionTrends,
  wardStatistics,
  volunteerGroups,
  duplicateComplaints,
  mergedComplaints,
  duplicatesPrevented,
  topDuplicateCategories,
  duplicateSupportCount
] = await Promise.all([
    Complaint.countDocuments(match),
    Complaint.countDocuments({ ...match, status: { $in: OPEN_STATUSES } }),
    Complaint.countDocuments({ ...match, status: { $in: RESOLVED_STATUSES } }),
    Complaint.countDocuments({ ...match, status: { $in: REJECTED_STATUSES } }),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $match: { ...match, status: { $in: REJECTED_STATUSES } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, category: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, status: '$_id', count: 1 } }
    ]),
    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          submitted: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $in: ['$status', RESOLVED_STATUSES] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $in: ['$status', REJECTED_STATUSES] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', submitted: 1, resolved: 1, rejected: 1 } }
    ]),
    Complaint.aggregate([
      { $match: { ...match, resolvedAt: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$resolvedAt' } },
          resolved: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', resolved: 1 } }
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
          resolvedComplaints: countByStatus(RESOLVED_STATUSES),
          rejectedComplaints: countByStatus(REJECTED_STATUSES)
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
          resolvedComplaints: 1,
          rejectedComplaints: 1
        }
      }
    ]),
    req.user.role === 'admin' ? Complaint.countDocuments({ $or: [{ duplicateOf: { $exists: true, $ne: null } }, { masterComplaint: { $exists: true, $ne: null } }, { isDuplicate: true }] }) : Promise.resolve(0),
    req.user.role === 'admin' ? Complaint.countDocuments({ mergedAt: { $ne: null } }) : Promise.resolve(0),
    req.user.role === 'admin' ? DuplicateSupport.distinct('complaint').then((items) => items.length) : Promise.resolve(0),
    req.user.role === 'admin' ? DuplicateSupport.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 5 }, { $project: { _id: 0, category: '$_id', count: 1 } }]) : Promise.resolve([]),
    req.user.role === 'admin' ? DuplicateSupport.countDocuments() : Promise.resolve(0)
  ]);

  const wardStats = wardStatistics.map((ward) => ({
    ...ward,
    resolutionRate: calculateRate(ward.resolvedComplaints, ward.totalComplaints)
  }));
  const volunteerPerformance = volunteerGroups.map((volunteer) => ({
    ...volunteer,
    resolutionRate: calculateRate(
      volunteer.resolvedComplaints,
      Math.max(volunteer.assignedComplaints - volunteer.rejectedComplaints, 0)
    )
  }));

    return {
    totalComplaints,
    openComplaints,
    resolvedComplaints,
    rejectedComplaints,
    rejectionRate: calculateRate(rejectedComplaints, totalComplaints),
    categoryCounts,
    topRejectionCategories,
    statusCounts,
    monthlyTrends,
    resolutionTrends,
    wardStatistics: wardStats,
    volunteerPerformance,
    duplicateComplaints,
    mergedComplaints,
    duplicatesPrevented,
    topDuplicateCategories,
    duplicateSupportCount,
    filters: {
      wardId: query.wardId || null,
      from: query.fromDate?.toISOString() || null,
      to: query.toDate?.toISOString() || null
    }
  };
}

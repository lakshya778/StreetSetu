import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import DuplicateSupport from '../models/DuplicateSupport.js';
import Assignment from '../models/Assignment.js';
import Feedback from '../models/Feedback.js';

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
  const performanceMatch = req.user.role === 'volunteer' ? buildMatch(query, { user: { ...req.user, role: 'admin' } }) : match;
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
  volunteerTrends,
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
    Assignment.aggregate([
      { $match: { ...(req.user.role === 'admin' ? {} : req.user.role === 'volunteer' ? { volunteer: new mongoose.Types.ObjectId(req.user.sub) } : { _id: { $exists: false } }), ...(query.fromDate || query.toDate ? { assignedAt: { ...(query.fromDate ? { $gte: query.fromDate } : {}), ...(query.toDate ? { $lte: query.toDate } : {}) } } : {}) } },
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'complaint' } },
      { $unwind: '$complaint' },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$assignedAt' } }, assignments: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', assignments: 1, resolved: 1 } }
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
      { $match: { ...performanceMatch, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          assignedComplaints: { $sum: 1 },
          openComplaints: countByStatus(OPEN_STATUSES),
          resolvedComplaints: countByStatus(RESOLVED_STATUSES),
          rejectedComplaints: countByStatus(REJECTED_STATUSES),
          averageCompletionMs: { $avg: { $cond: [{ $and: [{ $in: ['$status', RESOLVED_STATUSES] }, { $ne: ['$resolvedAt', null] }] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } }
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
          rejectedComplaints: 1,
          averageCompletionMs: 1
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
    averageCompletionDays: volunteer.averageCompletionMs == null ? null : Math.round((volunteer.averageCompletionMs / 86400000) * 10) / 10,
    resolutionRate: calculateRate(
      volunteer.resolvedComplaints,
      Math.max(volunteer.assignedComplaints - volunteer.rejectedComplaints, 0)
    )
  })).sort((left, right) => right.resolutionRate - left.resolutionRate || right.resolvedComplaints - left.resolvedComplaints || right.assignedComplaints - left.assignedComplaints);

  const assignmentScope = req.user.role === 'admin' ? {} : req.user.role === 'volunteer'
    ? { volunteer: new mongoose.Types.ObjectId(req.user.sub) }
    : { _id: { $exists: false } };
  const [distanceSummary, assignmentSummary, routeSummary] = await Promise.all([
    Assignment.aggregate([
      { $match: { ...assignmentScope, distanceKm: { $gte: 0 } } },
      { $group: { _id: null, averageDistanceKm: { $avg: '$distanceKm' } } },
      { $project: { _id: 0, averageDistanceKm: 1 } }
    ]),
    Complaint.aggregate([
      { $match: { ...match, assignedTo: { $ne: null } } },
      { $group: { _id: null, assignedComplaints: { $sum: 1 }, resolvedAssigned: { $sum: { $cond: [{ $in: ['$status', RESOLVED_STATUSES] }, 1, 0] } } } }
    ]),
    Assignment.aggregate([
      { $match: { ...assignmentScope, isActive: true } },
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'complaint' } },
      { $unwind: '$complaint' },
      { $group: {
        _id: null,
        distanceKm: { $sum: { $ifNull: ['$distanceKm', 0] } },
        completedCount: { $sum: { $cond: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, 1, 0] } },
        completedDistanceKm: { $sum: { $cond: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, { $ifNull: ['$distanceKm', 0] }, 0] } },
        averageCompletionMs: { $avg: { $cond: [{ $and: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, { $ne: ['$complaint.resolvedAt', null] }] }, { $subtract: ['$complaint.resolvedAt', '$complaint.createdAt'] }, null] } }
      } }
    ])
  ]);
  const assignmentTotals = assignmentSummary[0] || { assignedComplaints: 0, resolvedAssigned: 0 };
  const volunteerWorkload = volunteerPerformance.map((volunteer) => ({
    volunteerId: volunteer.volunteerId,
    volunteerName: volunteer.volunteerName,
    assignedComplaints: volunteer.assignedComplaints,
    activeAssignments: volunteer.openComplaints
  }));
  const averageResponseDistanceKm = distanceSummary[0]?.averageDistanceKm;
  const assignmentEfficiency = calculateRate(assignmentTotals.resolvedAssigned, assignmentTotals.assignedComplaints);
  const routeTotals = routeSummary[0] || { completedCount: 0, completedDistanceKm: 0 };
  const complaintsCompletedPerKm = routeTotals.completedDistanceKm > 0
    ? Math.round((routeTotals.completedCount / routeTotals.completedDistanceKm) * 100) / 100 : 0;
  const routeEfficiencyScore = Math.min(100, Math.round(complaintsCompletedPerKm * 10));
  const averageCompletionDays = routeTotals.averageCompletionMs == null ? null : Math.round((routeTotals.averageCompletionMs / 86400000) * 10) / 10;
  const volunteerRating = req.user.role === 'volunteer'
    ? (await Feedback.aggregate([
      { $match: { volunteer: new mongoose.Types.ObjectId(req.user.sub) } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
    ]))[0]
    : null;
  const volunteerRank = req.user.role === 'volunteer'
    ? volunteerPerformance.findIndex((volunteer) => String(volunteer.volunteerId) === String(req.user.sub)) + 1 : null;

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
    volunteerTrends,
    wardStatistics: wardStats,
    volunteerPerformance,
    volunteerRank: volunteerRank > 0 ? volunteerRank : null,
    averageRating: volunteerRating?.averageRating == null ? null : Math.round(volunteerRating.averageRating * 10) / 10,
    ratingCount: volunteerRating?.ratingCount || 0,
    volunteerWorkload,
    totalVolunteerWorkload: volunteerWorkload.reduce((total, volunteer) => total + volunteer.activeAssignments, 0),
    averageResponseDistanceKm: averageResponseDistanceKm === undefined ? null : Math.round(averageResponseDistanceKm * 10) / 10,
    averageTravelDistanceKm: averageResponseDistanceKm === undefined ? null : Math.round(averageResponseDistanceKm * 10) / 10,
    assignmentEfficiency,
    averageCompletionDays,
    complaintsCompletedPerKm,
    routeEfficiencyScore,
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

import Assignment from '../models/Assignment.js';
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';

const RESOLVED_STATUSES = ['resolved', 'closed'];
const round = (value) => Math.round(value * 10) / 10;

export async function getVolunteerLeaderboard(limit = 10) {
  const [volunteers, assignments, ratings] = await Promise.all([
    User.find({ role: 'volunteer', isActive: true }).select('name city area').sort({ name: 1 }).lean(),
    Assignment.aggregate([
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'complaint' } },
      { $unwind: '$complaint' },
      { $group: {
        _id: '$volunteer',
        totalAssignments: { $sum: 1 },
        resolvedComplaints: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $in: ['$complaint.status', RESOLVED_STATUSES] }] }, 1, 0] } },
        acceptedAssignments: { $sum: { $cond: [{ $eq: ['$responseStatus', 'accepted'] }, 1, 0] } },
        respondedAssignments: { $sum: { $cond: [{ $in: ['$responseStatus', ['accepted', 'declined']] }, 1, 0] } },
        averageCompletionMs: { $avg: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $in: ['$complaint.status', RESOLVED_STATUSES] }, { $ne: ['$complaint.resolvedAt', null] }] }, { $subtract: ['$complaint.resolvedAt', '$assignedAt'] }, null] } }
      } }
    ]),
    Feedback.aggregate([
      { $group: { _id: '$volunteer', averageRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
    ])
  ]);

  const assignmentByVolunteer = new Map(assignments.map((row) => [String(row._id), row]));
  const ratingsByVolunteer = new Map(ratings.map((row) => [String(row._id), row]));
  const rows = volunteers.map((volunteer) => {
    const assignment = assignmentByVolunteer.get(String(volunteer._id)) || {};
    const feedback = ratingsByVolunteer.get(String(volunteer._id)) || {};
    const averageCompletionDays = assignment.averageCompletionMs == null ? null : assignment.averageCompletionMs / 86400000;
    const assignmentAcceptanceRate = assignment.respondedAssignments
      ? (assignment.acceptedAssignments / assignment.respondedAssignments) * 100 : 0;
    return {
      volunteerId: volunteer._id,
      volunteerName: volunteer.name,
      city: volunteer.city || '',
      area: volunteer.area || '',
      resolvedComplaints: assignment.resolvedComplaints || 0,
      averageRating: feedback.averageRating == null ? null : round(feedback.averageRating),
      ratingCount: feedback.ratingCount || 0,
      averageCompletionDays: averageCompletionDays == null ? null : round(averageCompletionDays),
      assignmentAcceptanceRate: round(assignmentAcceptanceRate),
      totalAssignments: assignment.totalAssignments || 0,
      respondedAssignments: assignment.respondedAssignments || 0
    };
  });

  const maxResolved = Math.max(0, ...rows.map((row) => row.resolvedComplaints));
  const completionTimes = rows.map((row) => row.averageCompletionDays).filter(Number.isFinite);
  const fastestDays = completionTimes.length ? Math.min(...completionTimes) : null;
  const slowestDays = completionTimes.length ? Math.max(...completionTimes) : null;

  return rows.map((row) => {
    const resolvedScore = maxResolved ? (row.resolvedComplaints / maxResolved) * 100 : 0;
    const ratingScore = row.averageRating == null ? 0 : (row.averageRating / 5) * 100;
    const resolutionSpeedScore = row.averageCompletionDays == null ? 0
      : fastestDays === slowestDays ? 100
        : ((slowestDays - row.averageCompletionDays) / (slowestDays - fastestDays)) * 100;
    const scoreBreakdown = {
      resolvedComplaints: round(resolvedScore),
      averageRating: round(ratingScore),
      resolutionSpeed: round(resolutionSpeedScore),
      assignmentAcceptance: row.assignmentAcceptanceRate
    };
    const score = round(scoreBreakdown.resolvedComplaints * 0.4
      + scoreBreakdown.averageRating * 0.3
      + scoreBreakdown.resolutionSpeed * 0.2
      + scoreBreakdown.assignmentAcceptance * 0.1);
    return { ...row, score, scoreBreakdown };
  }).sort((left, right) => right.score - left.score
    || right.resolvedComplaints - left.resolvedComplaints
    || (right.averageRating || 0) - (left.averageRating || 0))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

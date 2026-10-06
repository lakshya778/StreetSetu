import Complaint from '../models/Complaint.js';
import { getDashboardSummary } from './dashboardService.js';
import { getVolunteerLeaderboard } from './leaderboardService.js';

function complaintMatch(query = {}) {
  const match = {};
  if (query.category) match.category = query.category;
  if (query.status) match.status = query.status;
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }
  return match;
}

export async function getAnalyticsOverview(req) {
  const summary = await getDashboardSummary(req.dashboardQuery || {}, req);
  return {
    totalComplaints: summary.totalComplaints,
    openComplaints: summary.openComplaints,
    resolvedComplaints: summary.resolvedComplaints,
    resolutionRate: summary.totalComplaints
      ? Math.round((summary.resolvedComplaints / summary.totalComplaints) * 1000) / 10 : 0
  };
}

export async function getCategoryAnalytics(query = {}) {
  return Complaint.aggregate([
    { $match: complaintMatch(query) },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, category: '$_id', count: 1 } }
  ]);
}

export async function getAreaAnalytics(query = {}) {
  const addressArea = { $trim: { input: { $arrayElemAt: [{ $split: [{ $ifNull: ['$address', ''] }, ','] }, 0] } } };
  return Complaint.aggregate([
    { $match: complaintMatch(query) },
    { $set: { _areaName: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$area', ''] } }, 0] }, '$area', addressArea] } } },
    { $match: { _areaName: { $nin: ['', null] } } },
    { $group: { _id: '$_areaName', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 20 },
    { $project: { _id: 0, area: '$_id', count: 1 } }
  ]);
}

export async function getResolutionTrend() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const rows = await Complaint.aggregate([
    { $match: { status: { $in: ['resolved', 'closed'] }, resolvedAt: { $gte: start, $lt: endExclusive } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: 'UTC' } }, resolved: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  const countByDate = new Map(rows.map(({ _id, resolved }) => [_id, resolved]));
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: key.slice(5), resolved: countByDate.get(key) || 0 };
  });
  return { days, totalResolved: days.reduce((total, day) => total + day.resolved, 0) };
}

export async function getAdvancedLeaderboard(limit) {
  return getVolunteerLeaderboard(limit);
}

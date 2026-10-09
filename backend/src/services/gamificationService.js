import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import Drive from '../models/Drive.js';
import PointEvent from '../models/PointEvent.js';
import User from '../models/User.js';
import Vote from '../models/Vote.js';
import { ensureReferralCode } from './referralService.js';

const POINT_RULES = {
  report_created: { points: 5, refType: 'complaint' },
  complaint_resolved: { points: 10, refType: 'complaint' },
  drive_joined: { points: 15, refType: 'drive' },
  drive_organized: { points: 25, refType: 'drive' },
  support_received: { points: 2, refType: 'vote' },
  referral_bonus: { points: 20, refType: 'user' }
};
const BADGES = [
  { key: 'first_report', label: 'First Report', condition: (counts) => counts.report_created >= 1 },
  { key: 'community_hero', label: 'Community Hero', condition: (counts) => counts.complaint_resolved >= 3 },
  { key: 'drive_volunteer', label: 'Drive Volunteer', condition: (counts) => counts.drive_joined >= 1 },
  { key: 'drive_organizer', label: 'Drive Organizer', condition: (counts) => counts.drive_organized >= 1 },
  { key: 'points_100', label: 'Points 100', condition: (_counts, points) => points >= 100 },
  { key: 'points_500', label: 'Points 500', condition: (_counts, points) => points >= 500 }
];
const RESOLVED_STATUSES = ['resolved', 'closed'];
const IMPACT_ESTIMATE_PER_RESOLUTION = 25;

function currentMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`;
}

function isoWeek(date) {
  const localDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = new Date(Date.UTC(
    Number(localDate.find((part) => part.type === 'year').value),
    Number(localDate.find((part) => part.type === 'month').value) - 1,
    Number(localDate.find((part) => part.type === 'day').value)
  ));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function previousIsoWeek(week) {
  const [year, weekNumber] = week.split('-W').map(Number);
  const monday = new Date(Date.UTC(year, 0, 4 + ((weekNumber - 1) * 7)));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  monday.setUTCDate(monday.getUTCDate() - 7);
  return isoWeek(monday);
}

async function updateReportStreak(userId, occurredAt) {
  const week = isoWeek(occurredAt);
  const previousWeek = previousIsoWeek(week);
  const continued = await User.updateOne(
    { _id: userId, lastReportWeek: previousWeek },
    { $inc: { streakWeeks: 1 }, $set: { lastReportWeek: week } }
  );
  if (continued.matchedCount) return;
  await User.updateOne(
    { _id: userId, lastReportWeek: { $ne: week } },
    { $set: { streakWeeks: 1, lastReportWeek: week } }
  );
}

function asObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw new Error(`Invalid ${label}`);
  return new mongoose.Types.ObjectId(value);
}

function logGamificationError(action, error, context = {}) {
  console.error(`[gamification] ${action} failed`, {
    ...context,
    message: error?.message || String(error)
  });
}

async function ensureDatabaseConnection() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected');
  }
}

async function awardEligibleBadges(userId) {
  const [counts, user] = await Promise.all([
    PointEvent.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    User.findById(userId).select('totalPoints').lean()
  ]);
  if (!user) throw new Error('Gamification user not found');
  const eventCounts = Object.fromEntries(counts.map((item) => [item._id, item.count]));
  const now = new Date();

  for (const badge of BADGES) {
    if (!badge.condition(eventCounts, user.totalPoints || 0)) continue;
    await User.updateOne(
      { _id: userId, 'badges.key': { $ne: badge.key } },
      { $push: { badges: { key: badge.key, label: badge.label, awardedAt: now } } }
    );
  }
}

export async function awardPoints(userIdValue, type, refIdValue, occurredAt = new Date()) {
  try {
    const rule = POINT_RULES[type];
    if (!rule) throw new Error(`Unknown point event type: ${type}`);
    await ensureDatabaseConnection();
    const userId = asObjectId(userIdValue, 'user id');
    const refId = asObjectId(refIdValue, 'reference id');
    const createdAt = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    if (!Number.isFinite(createdAt.getTime())) throw new Error('Invalid point event timestamp');
    const month = currentMonth(createdAt);

    try {
      await PointEvent.create({ user: userId, type, points: rule.points, refType: rule.refType, refId, month, createdAt });
    } catch (error) {
      if (error?.code === 11000) return false;
      throw error;
    }

    if (type === 'report_created') {
      try {
        await updateReportStreak(userId, createdAt);
      } catch (error) {
        logGamificationError('update report streak', error, { userId: String(userId), refId: String(refId) });
      }
    }

    const monthlyIncrement = {
      $inc: { totalPoints: rule.points, monthlyPoints: rule.points }
    };
    let updateResult = await User.updateOne(
      { _id: userId, monthlyPointsMonth: month },
      monthlyIncrement
    );
    if (!updateResult.matchedCount) {
      updateResult = await User.updateOne(
        { _id: userId, monthlyPointsMonth: { $ne: month } },
        {
          $set: { monthlyPoints: rule.points, monthlyPointsMonth: month },
          $inc: { totalPoints: rule.points }
        }
      );
    }
    if (!updateResult.matchedCount) {
      updateResult = await User.updateOne(
        { _id: userId, monthlyPointsMonth: month },
        monthlyIncrement
      );
    }
    if (!updateResult.matchedCount) throw new Error('Gamification user not found');
    await awardEligibleBadges(userId);
    return true;
  } catch (error) {
    logGamificationError('award points', error, { userId: String(userIdValue), type, refId: String(refIdValue) });
    return false;
  }
}

export async function revokePoints(userIdValue, type, refIdValue) {
  try {
    await ensureDatabaseConnection();
    const userId = asObjectId(userIdValue, 'user id');
    const refId = asObjectId(refIdValue, 'reference id');
    const event = await PointEvent.findOneAndDelete({ user: userId, type, refId });
    if (!event) return false;

    await User.updateOne({ _id: userId }, [{
      $set: {
        totalPoints: { $max: [0, { $subtract: [{ $ifNull: ['$totalPoints', 0] }, event.points] }] },
        monthlyPoints: {
          $cond: [
            { $eq: [{ $ifNull: ['$monthlyPointsMonth', ''] }, event.month] },
            { $max: [0, { $subtract: [{ $ifNull: ['$monthlyPoints', 0] }, event.points] }] },
            { $ifNull: ['$monthlyPoints', 0] }
          ]
        }
      }
    }]);
    return true;
  } catch (error) {
    logGamificationError('revoke points', error, { userId: String(userIdValue), type, refId: String(refIdValue) });
    return false;
  }
}

function eventCountsToBadges(events, totalPoints) {
  const counts = {};
  for (const event of events) counts[event.type] = (counts[event.type] || 0) + 1;
  const awardedAt = new Date();
  return BADGES.filter((badge) => badge.condition(counts, totalPoints))
    .map(({ key, label }) => ({ key, label, awardedAt }));
}

function monthFor(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? currentMonth(date) : currentMonth();
}

function buildEvent(user, type, refType, refId, createdAt) {
  const rule = POINT_RULES[type];
  const date = createdAt ? new Date(createdAt) : new Date();
  return {
    user,
    type,
    points: rule.points,
    refType,
    refId,
    month: monthFor(date),
    createdAt: date
  };
}

export async function rebuildGamificationData() {
  await ensureDatabaseConnection();
  await PointEvent.init();

  const [users, complaints, drives, votes] = await Promise.all([
    User.find({}).select('_id badges referredBy createdAt').lean(),
    Complaint.find({}).select('_id createdBy status completionVerification.reviewDecision createdAt updatedAt resolvedAt').lean(),
    Drive.find({}).select('_id createdBy participants participantHistory createdAt').lean(),
    Vote.find({}).populate('complaint', 'createdBy').lean()
  ]);
  const events = [];

  for (const complaint of complaints) {
    if (!complaint.createdBy) continue;
    events.push(buildEvent(complaint.createdBy, 'report_created', 'complaint', complaint._id, complaint.createdAt));
    if (complaint.completionVerification?.reviewDecision === 'approved'
      && RESOLVED_STATUSES.includes(complaint.status)) {
      events.push(buildEvent(complaint.createdBy, 'complaint_resolved', 'complaint', complaint._id, complaint.resolvedAt || complaint.updatedAt || complaint.createdAt));
    }
  }

  for (const drive of drives) {
    if (!drive.createdBy) continue;
    events.push(buildEvent(drive.createdBy, 'drive_organized', 'drive', drive._id, drive.createdAt));
    const creatorId = String(drive.createdBy._id || drive.createdBy);
    const participants = new Map();
    for (const event of drive.participantHistory || []) {
      const participantId = event.user?._id || event.user;
      if (String(participantId) !== creatorId && !participants.has(String(participantId))) {
        participants.set(String(participantId), { user: participantId, joinedAt: event.joinedAt });
      }
    }
    for (const participant of drive.participants || []) {
      const participantId = participant?._id || participant;
      if (String(participantId) !== creatorId && !participants.has(String(participantId))) {
        participants.set(String(participantId), { user: participantId, joinedAt: drive.createdAt });
      }
    }
    for (const participant of participants.values()) {
      events.push(buildEvent(participant.user, 'drive_joined', 'drive', drive._id, participant.joinedAt || drive.createdAt));
    }
  }

  for (const vote of votes) {
    const ownerId = vote.complaint?.createdBy?._id || vote.complaint?.createdBy;
    if (!ownerId || String(ownerId) === String(vote.user)) continue;
    events.push(buildEvent(ownerId, 'support_received', 'vote', vote._id, vote.createdAt));
  }

  for (const user of users) {
    if (user.referredBy && String(user.referredBy) !== String(user._id)) {
      events.push(buildEvent(user.referredBy, 'referral_bonus', 'user', user._id, user.createdAt));
    }
  }

  await PointEvent.deleteMany({});
  for (let index = 0; index < events.length; index += 1000) {
    await PointEvent.insertMany(events.slice(index, index + 1000), { ordered: true });
  }

  const nowMonth = currentMonth();
  const eventGroups = new Map();
  for (const event of events) {
    const id = String(event.user);
    const summary = eventGroups.get(id) || { totalPoints: 0, monthlyPoints: 0, events: [] };
    summary.totalPoints += event.points;
    if (event.month === nowMonth) summary.monthlyPoints += event.points;
    summary.events.push(event);
    eventGroups.set(id, summary);
  }

  const operations = users.map(({ _id, badges = [] }) => {
    const summary = eventGroups.get(String(_id)) || { totalPoints: 0, monthlyPoints: 0, events: [] };
    const earnedBadges = eventCountsToBadges(summary.events, summary.totalPoints);
    const permanentMonthlyBadges = badges.filter((badge) => /^monthly_(champion|top3)_\d{4}-\d{2}$/.test(badge.key));
    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: {
            totalPoints: summary.totalPoints,
            monthlyPoints: summary.monthlyPoints,
            monthlyPointsMonth: nowMonth,
            badges: [...earnedBadges, ...permanentMonthlyBadges]
          }
        }
      }
    };
  });
  for (let index = 0; index < operations.length; index += 1000) {
    await User.bulkWrite(operations.slice(index, index + 1000));
  }

  return { users: users.length, pointEvents: events.length };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getWardEvents(wardId, month) {
  const locationFilter = mongoose.isValidObjectId(wardId)
    ? { wardId: asObjectId(wardId, 'ward id') }
    : {
      $or: [
        { area: { $regex: `^${escapeRegex(String(wardId).trim())}$`, $options: 'i' } },
        { city: { $regex: `^${escapeRegex(String(wardId).trim())}$`, $options: 'i' } },
        { address: { $regex: `^${escapeRegex(String(wardId).trim())}(?:,|$)`, $options: 'i' } }
      ]
    };
  const complaints = await Complaint.find({ ...locationFilter, isAnonymous: { $ne: true } }).select('_id').lean();
  const complaintIds = complaints.map((complaint) => complaint._id);
  if (!complaintIds.length) return [];
  const votes = await Vote.find({ complaint: { $in: complaintIds } }).select('_id').lean();
  return PointEvent.aggregate([
    {
      $match: {
        ...(month ? { month } : {}),
        $or: [
          { refType: 'complaint', refId: { $in: complaintIds } },
          { refType: 'vote', refId: { $in: votes.map((vote) => vote._id) } }
        ]
      }
    },
    { $group: { _id: '$user', points: { $sum: '$points' } } }
  ]);
}

export async function getLeaderboard({ scope = 'all', ward, viewerId } = {}) {
  await ensureDatabaseConnection();
  if (!['month', 'all'].includes(scope)) throw new Error('Leaderboard scope must be month or all');
  const useMonthlyPoints = scope === 'month';
  const month = useMonthlyPoints ? currentMonth() : null;
  let users;

  if (ward) {
    const totals = await getWardEvents(ward, month);
    const ids = totals.map((row) => row._id);
    const usersById = await User.find({ _id: { $in: ids }, isActive: true })
      .select('name badges').lean();
    const pointsById = new Map(totals.map((row) => [String(row._id), row.points]));
    users = usersById.map((user) => ({ ...user, points: pointsById.get(String(user._id)) || 0 }));
  } else {
    const rows = await User.find({ isActive: true })
      .select('name totalPoints monthlyPoints monthlyPointsMonth badges').lean();
    users = rows.map((user) => ({
      ...user,
      points: useMonthlyPoints
        ? (user.monthlyPointsMonth === month ? user.monthlyPoints || 0 : 0)
        : (user.totalPoints || 0)
    }));
  }

  return users
    .filter((user) => user.points > 0)
    .sort((left, right) => right.points - left.points
      || String(left.name || '').localeCompare(String(right.name || ''))
      || String(left._id).localeCompare(String(right._id)))
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      displayName: user.name || 'StreetSetu member',
      points: user.points,
      badgesCount: user.badges?.length || 0,
      isMe: Boolean(viewerId && String(user._id) === String(viewerId))
    }));
}

export async function getMyGamificationStats(userIdValue) {
  await ensureDatabaseConnection();
  const userId = asObjectId(userIdValue, 'user id');
  const [user, complaints, drivesJoined, drivesOrganized] = await Promise.all([
    User.findById(userId).select('totalPoints monthlyPoints monthlyPointsMonth badges streakWeeks lastReportWeek referralCode').lean(),
    Complaint.find({ createdBy: userId })
      .select('_id title status beforeImages afterImages resolvedAt wardId area city address').sort({ createdAt: -1 }).lean(),
    Drive.countDocuments({
      createdBy: { $ne: userId },
      $or: [{ participants: userId }, { 'participantHistory.user': userId }]
    }),
    Drive.countDocuments({ createdBy: userId })
  ]);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (!user.referralCode) user.referralCode = await ensureReferralCode(userId);

  const resolved = complaints.filter((complaint) => RESOLVED_STATUSES.includes(complaint.status));
  const month = currentMonth();
  const monthlyPoints = user.monthlyPointsMonth === month ? user.monthlyPoints || 0 : 0;
  const latestLocation = complaints.find((complaint) => complaint.wardId || complaint.area || complaint.city || complaint.address);
  const communityLocation = latestLocation && (
    latestLocation.wardId
      ? { label: latestLocation.area || latestLocation.city || 'Ward', key: String(latestLocation.wardId) }
      : latestLocation.area
        ? { label: latestLocation.area, key: latestLocation.area }
        : latestLocation.city
          ? { label: latestLocation.city, key: latestLocation.city }
          : { label: latestLocation.address.split(',')[0].trim(), key: latestLocation.address.split(',')[0].trim() }
  );
  let communityRank = null;
  if (communityLocation?.key) {
    const wardTotals = await getWardEvents(communityLocation.key, month);
    const rankedUsers = await User.find({ _id: { $in: wardTotals.map((row) => row._id) }, isActive: true })
      .select('_id name').lean();
    const pointsByUser = new Map(wardTotals.map((row) => [String(row._id), row.points]));
    const ordered = rankedUsers.map((row) => ({ ...row, points: pointsByUser.get(String(row._id)) || 0 }))
      .sort((left, right) => right.points - left.points
        || String(left.name || '').localeCompare(String(right.name || ''))
        || String(left._id).localeCompare(String(right._id)));
    const index = ordered.findIndex((row) => String(row._id) === String(userId));
    if (index >= 0) communityRank = index + 1;
  }
  const [monthlyAhead, allTimeAhead] = await Promise.all([
    User.countDocuments({
      isActive: true,
      $expr: {
        $gt: [
          {
            $cond: [
              { $eq: ['$monthlyPointsMonth', month] },
              { $ifNull: ['$monthlyPoints', 0] },
              0
            ]
          },
          monthlyPoints
        ]
      }
    }),
    User.countDocuments({ isActive: true, totalPoints: { $gt: user.totalPoints || 0 } })
  ]);

  return {
    totalPoints: user.totalPoints || 0,
    monthlyPoints,
    rank: { monthly: monthlyAhead + 1, allTime: allTimeAhead + 1 },
    reports: complaints.length,
    resolved: resolved.length,
    drivesJoined,
    drivesOrganized,
    streakWeeks: user.streakWeeks || 0,
    lastReportWeek: user.lastReportWeek || null,
    referralCode: user.referralCode || null,
    community: communityLocation ? { ...communityLocation, rank: communityRank } : null,
    badges: user.badges || [],
    peopleImpactedEstimate: { value: resolved.length * IMPACT_ESTIMATE_PER_RESOLUTION, label: 'estimate' },
    beforeAfter: resolved.map((complaint) => ({
      complaintId: String(complaint._id),
      title: complaint.title,
      beforePhotoUrl: complaint.beforeImages?.find((image) => image?.url)?.url || null,
      afterPhotoUrl: complaint.afterImages?.find((image) => image?.url)?.url || null
    }))
  };
}

export const gamificationServiceInternals = { currentMonth, isoWeek, previousIsoWeek };

export default { awardPoints, revokePoints, rebuildGamificationData, getLeaderboard, getMyGamificationStats };

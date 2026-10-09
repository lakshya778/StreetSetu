import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import MonthlyGamificationClose from '../models/MonthlyGamificationClose.js';
import MonthlyWinner from '../models/MonthlyWinner.js';
import PointEvent from '../models/PointEvent.js';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import { createSystemInAppNotification } from './notificationService.js';

const CERTIFICATE_DIRECTORY = process.env.GAMIFICATION_CERTIFICATE_DIR
  ? path.resolve(process.env.GAMIFICATION_CERTIFICATE_DIR)
  : fileURLToPath(new URL('../../storage/certificates/', import.meta.url));
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function validateMonth(month) {
  if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
    const error = new Error('Month must use YYYY-MM format');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return month;
}

function monthLabel(month) {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, number - 1, 1)));
}

function previousMonthInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year').value);
  const month = Number(parts.find((part) => part.type === 'month').value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

function conflict(message, code) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = code;
  return error;
}

async function claimMonth(month) {
  const now = new Date();
  const lockToken = randomUUID();
  const current = await MonthlyGamificationClose.findOne({ month }).lean();
  if (current?.status === 'closed') return { closed: true };
  if (current?.status === 'running' && current.lockExpiresAt > now) {
    throw conflict('This month is already being closed', 'MONTH_CLOSE_IN_PROGRESS');
  }

  if (current) {
    const claimFilter = current.status === 'failed'
      ? { _id: current._id, status: 'failed' }
      : { _id: current._id, status: 'running', lockExpiresAt: { $lte: now } };
    const claimed = await MonthlyGamificationClose.findOneAndUpdate(
      claimFilter,
      { $set: { status: 'running', lockToken, lockExpiresAt: new Date(now.getTime() + 60 * 60 * 1000), failureReason: null } },
      { new: true }
    ).lean();
    if (!claimed) throw conflict('This month is already being closed', 'MONTH_CLOSE_IN_PROGRESS');
    return { lockToken };
  }

  try {
    await MonthlyGamificationClose.create({
      month,
      status: 'running',
      lockToken,
      lockExpiresAt: new Date(now.getTime() + 60 * 60 * 1000)
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await MonthlyGamificationClose.findOne({ month }).lean();
    if (existing?.status === 'closed') return { closed: true };
    throw conflict('This month is already being closed', 'MONTH_CLOSE_IN_PROGRESS');
  }
  return { lockToken };
}

async function monthPointLeaders(month) {
  const totals = await PointEvent.aggregate([
    { $match: { month } },
    { $group: { _id: '$user', points: { $sum: '$points' } } },
    { $match: { points: { $gt: 0 } } },
    { $sort: { points: -1, _id: 1 } },
    { $limit: 3 }
  ]);
  if (!totals.length) return [];
  const users = await User.find({ _id: { $in: totals.map(({ _id }) => _id) } })
    .select('_id name').lean();
  const namesById = new Map(users.map((user) => [String(user._id), user.name]));
  return totals
    .filter((row) => namesById.has(String(row._id)))
    .map((row, index) => ({ user: row._id, name: namesById.get(String(row._id)), points: row.points, rank: index + 1 }));
}

async function writeCertificate({ userName, month, rank, points, certificatePath, issuedAt }) {
  await mkdir(CERTIFICATE_DIRECTORY, { recursive: true });
  const filePath = path.join(CERTIFICATE_DIRECTORY, path.basename(certificatePath));
  const document = new PDFDocument({ size: 'A4', margin: 56 });
  if (process.env.GAMIFICATION_CERTIFICATE_FONT_PATH) {
    document.registerFont('StreetSetu', path.resolve(process.env.GAMIFICATION_CERTIFICATE_FONT_PATH));
    document.font('StreetSetu');
  }
  const output = createWriteStream(filePath);
  const finished = new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
    document.on('error', reject);
  });
  document.pipe(output);
  document.fontSize(15).fillColor('#52745b').text('STREETSETU', { align: 'center', characterSpacing: 2 });
  document.moveDown(2);
  document.fontSize(30).fillColor('#183b2b').text('Setu Champion of the Month', { align: 'center' });
  document.moveDown(1.5);
  document.fontSize(16).fillColor('#334155').text('This certificate is proudly presented to', { align: 'center' });
  document.moveDown(0.75);
  document.fontSize(28).fillColor('#183b2b').text(userName, { align: 'center' });
  document.moveDown(1);
  document.fontSize(17).fillColor('#334155').text(`${monthLabel(month)} · ${rank === 1 ? 'Rank 1' : `Top 3 · Rank ${rank}`}`, { align: 'center' });
  document.moveDown(0.5);
  document.fontSize(15).text(`${points.toLocaleString()} community points`, { align: 'center' });
  document.moveDown(2);
  document.fontSize(12).fillColor('#64748b').text(`Issued ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(issuedAt)}`, { align: 'center' });
  document.end();
  await finished;
  return filePath;
}

async function addPermanentWinnerBadge(winner, month) {
  const isChampion = winner.rank === 1;
  const key = `monthly_${isChampion ? 'champion' : 'top3'}_${month}`;
  const label = `${monthLabel(month)} ${isChampion ? 'Champion' : 'Top 3'}`;
  await User.updateOne(
    { _id: winner.user, 'badges.key': { $ne: key } },
    { $push: { badges: { key, label, awardedAt: new Date(), month } } }
  );
}

export async function closeMonth(month) {
  validateMonth(month);
  if (month >= currentIstMonth()) {
    const error = new Error('Only completed months can be closed');
    error.statusCode = 400;
    error.code = 'MONTH_NOT_COMPLETE';
    throw error;
  }
  if (mongoose.connection.readyState !== 1) throw new Error('MongoDB is not connected');
  const claim = await claimMonth(month);
  if (claim.closed) return { month, alreadyClosed: true, winners: [] };

  try {
    const leaders = await monthPointLeaders(month);
    const issuedAt = new Date();
    const winners = [];
    for (const leader of leaders) {
      const certificatePath = `${month}-rank-${leader.rank}-${leader.user}.pdf`;
      const winner = await MonthlyWinner.findOneAndUpdate(
        { month, rank: leader.rank },
        { $set: { user: leader.user, points: leader.points, certificatePath } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await addPermanentWinnerBadge(leader, month);
      await writeCertificate({
        userName: leader.name,
        month,
        rank: leader.rank,
        points: leader.points,
        certificatePath,
        issuedAt
      });
      await createSystemInAppNotification({
        recipientId: leader.user,
        title: 'Monthly community recognition',
        message: `You ranked ${leader.rank} in ${monthLabel(month)} with ${leader.points} points. Your certificate is ready.`,
        metadata: { eventType: 'monthly_gamification_winner', month, rank: leader.rank, points: leader.points, certificateId: String(winner._id) },
        dedupeKey: `monthly-winner:${month}:${leader.rank}:${leader.user}`
      });
      winners.push({ rank: leader.rank, displayName: leader.name, points: leader.points });
    }

    const nextMonth = currentIstMonth();
    await User.updateMany(
      { $or: [{ monthlyPointsMonth: { $exists: false } }, { monthlyPointsMonth: { $lte: month } }] },
      { $set: { monthlyPoints: 0, monthlyPointsMonth: nextMonth } }
    );
    const closeResult = await MonthlyGamificationClose.updateOne(
      { month, lockToken: claim.lockToken },
      { $set: { status: 'closed', winnerCount: winners.length, closedAt: issuedAt }, $unset: { lockToken: 1, lockExpiresAt: 1, failureReason: 1 } }
    );
    if (!closeResult.matchedCount) throw conflict('The month-close lock was lost before completion', 'MONTH_CLOSE_LOCK_LOST');
    return { month, alreadyClosed: false, winners };
  } catch (error) {
    try {
      await MonthlyGamificationClose.updateOne(
        { month, lockToken: claim.lockToken },
        { $set: { status: 'failed', failureReason: String(error.message || error).slice(0, 1000) }, $unset: { lockToken: 1, lockExpiresAt: 1 } }
      );
    } catch (lockError) {
      console.error('[gamification] Could not mark month close as failed', { month, message: lockError.message });
    }
    throw error;
  }
}

export async function getLatestMonthlyTopThree() {
  const closure = await MonthlyGamificationClose.findOne({ status: 'closed' }).sort({ month: -1 }).select('month').lean();
  if (!closure) return { month: null, winners: [], cleanestWard: await getCleanestWard() };
  const winners = await MonthlyWinner.find({ month: closure.month }).sort({ rank: 1 }).populate('user', 'name').lean();
  return {
    month: closure.month,
    winners: winners.map((winner) => ({
      rank: winner.rank,
      displayName: winner.user?.name || 'StreetSetu member',
      points: winner.points
    })),
    cleanestWard: await getCleanestWard()
  };
}

function monthBounds(month) {
  const [year, value] = month.split('-').map(Number);
  return {
    start: new Date(`${month}-01T00:00:00+05:30`),
    end: new Date(`${year + (value === 12 ? 1 : 0)}-${String(value === 12 ? 1 : value + 1).padStart(2, '0')}-01T00:00:00+05:30`)
  };
}

function currentIstMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`;
}

async function getCleanestWard() {
  const bounds = monthBounds(currentIstMonth());
  const results = await Complaint.aggregate([
    {
      $match: {
        status: { $in: ['resolved', 'closed'] },
        $or: [
          { resolvedAt: { $gte: bounds.start, $lt: bounds.end } },
          { resolvedAt: { $exists: false }, updatedAt: { $gte: bounds.start, $lt: bounds.end } }
        ]
      }
    },
    {
      $project: {
        areaLabel: { $trim: { input: { $ifNull: ['$area', ''] } } },
        cityLabel: { $trim: { input: { $ifNull: ['$city', ''] } } },
        addressLabel: { $trim: { input: { $arrayElemAt: [{ $split: [{ $ifNull: ['$address', ''] }, ','] }, 0] } } },
        wardId: 1
      }
    },
    {
      $addFields: {
        label: {
          $cond: [
            { $ne: ['$areaLabel', ''] },
            '$areaLabel',
            { $cond: [{ $ne: ['$cityLabel', ''] }, '$cityLabel', '$addressLabel'] }
          ]
        }
      }
    },
    {
      $group: {
        _id: { $ifNull: ['$wardId', { $toLower: { $trim: { input: '$label' } } }] },
        label: { $first: { $cond: [{ $ne: ['$label', ''] }, '$label', { $concat: ['Ward ', { $toString: '$wardId' }] }] } },
        resolvedCount: { $sum: 1 }
      }
    },
    { $match: { _id: { $nin: [null, ''] } } },
    { $sort: { resolvedCount: -1, label: 1 } },
    { $limit: 1 }
  ]);
  if (!results.length) return null;
  return { label: results[0].label, resolvedCount: results[0].resolvedCount, month: currentIstMonth() };
}

export async function getMyCertificates(userId) {
  const winners = await MonthlyWinner.find({ user: userId }).sort({ month: -1, rank: 1 }).lean();
  return winners.map((winner) => ({
    id: String(winner._id),
    month: winner.month,
    rank: winner.rank,
    points: winner.points,
    createdAt: winner.createdAt,
    downloadUrl: `/users/me/certificates/${winner._id}/download`
  }));
}

export async function downloadMyCertificate(userId, winnerId) {
  if (!mongoose.isValidObjectId(winnerId)) {
    const error = new Error('Certificate was not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  const winner = await MonthlyWinner.findOne({ _id: winnerId, user: userId }).select('month rank certificatePath').lean();
  if (!winner) {
    const error = new Error('Certificate was not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  const filePath = path.join(CERTIFICATE_DIRECTORY, path.basename(winner.certificatePath));
  try {
    await access(filePath);
  } catch {
    const error = new Error('Certificate file is not available');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return { filePath, fileName: `streetsetu-${winner.month}-rank-${winner.rank}.pdf` };
}

export const monthlyGamificationInternals = { previousMonthInTimezone, monthBounds, monthLabel, currentIstMonth };

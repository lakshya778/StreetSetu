import mongoose from 'mongoose';
import Drive from '../models/Drive.js';
import gamificationService from './gamificationService.js';

function driveError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function serializeDrive(drive, req) {
  if (!drive) return null;
  const userId = req.user?.sub || req.user?.id;
  const participants = drive.participants || [];
  const createdBy = drive.createdBy?._id || drive.createdBy;
  return {
    _id: String(drive._id),
    title: drive.title,
    description: drive.description,
    locationText: drive.locationText,
    lat: drive.lat,
    lng: drive.lng,
    date: drive.date,
    createdBy: createdBy ? String(createdBy) : undefined,
    participantCount: participants.length,
    isParticipating: Boolean(userId && participants.some((participant) => String(participant?._id || participant) === String(userId))),
    status: drive.status
  };
}

export async function listDrives(req, now = new Date()) {
  const drives = await Drive.find({ status: 'upcoming', date: { $gte: now } })
    .sort({ date: 1 }).limit(100).lean();
  return drives.map((drive) => serializeDrive(drive, req));
}

export async function getDrive(id, req) {
  const drive = await Drive.findById(id).lean();
  if (!drive) throw driveError('Drive not found', 404, 'DRIVE_NOT_FOUND');
  return serializeDrive(drive, req);
}

export async function createDrive(payload, req) {
  const userId = req.user?.sub || req.user?.id;
  const drive = await Drive.create({ ...payload, createdBy: userId, participants: [userId], status: 'upcoming' });
  await gamificationService.awardPoints(userId, 'drive_organized', drive._id);
  return serializeDrive(drive.toObject(), req);
}

async function updateParticipation(id, req, joining) {
  const userId = req.user?.sub || req.user?.id;
  const joinedAt = new Date();
  const update = joining
    ? { $addToSet: { participants: userId }, $push: { participantHistory: { user: userId, joinedAt } } }
    : { $pull: { participants: userId } };
  const conditions = joining
    ? { _id: id, status: 'upcoming', date: { $gte: new Date() }, participants: { $ne: userId } }
    : { _id: id };
  const drive = await Drive.findOneAndUpdate(conditions, update, { new: true }).lean();
  if (drive) {
    const creatorId = drive.createdBy?._id || drive.createdBy;
    if (joining && String(creatorId) !== String(userId)) {
      await gamificationService.awardPoints(userId, 'drive_joined', drive._id, joinedAt);
    }
    return serializeDrive(drive, req);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw driveError('Drive not found', 404, 'DRIVE_NOT_FOUND');
  }
  const existing = await Drive.findById(id).lean();
  if (!existing) throw driveError('Drive not found', 404, 'DRIVE_NOT_FOUND');
  if (joining && (existing.status !== 'upcoming' || new Date(existing.date) < new Date())) {
    throw driveError('This drive is no longer open for joining', 409, 'DRIVE_NOT_OPEN');
  }
  return serializeDrive(existing, req);
}

export function joinDrive(id, req) {
  return updateParticipation(id, req, true);
}

export function leaveDrive(id, req) {
  return updateParticipation(id, req, false);
}

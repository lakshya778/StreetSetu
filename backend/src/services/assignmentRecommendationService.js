import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';

const RESOLVED_STATUSES = ['resolved', 'closed'];
const ACTIVE_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress'];
const EARTH_RADIUS_KM = 6371;

function recommendationError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function distanceInKm(from, to) {
  if (!from || !to) return null;
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function round(value) { return Math.round(value * 10) / 10; }

export async function recommendVolunteers(complaintId) {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw recommendationError('Complaint id must be valid', 400, 'VALIDATION_ERROR');
  }
  const complaint = await Complaint.findById(complaintId).lean();
  if (!complaint) throw recommendationError('Complaint not found', 404, 'NOT_FOUND');
  if (complaint.status !== 'under_review') {
    throw recommendationError('Volunteer recommendations are available for complaints under review', 409, 'INVALID_STATUS');
  }

  const volunteers = await User.find({ role: 'volunteer', isActive: true })
    .select('name email expertiseCategories location')
    .lean();
  if (!volunteers.length) return [];

  const performance = await Assignment.aggregate([
    { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'complaint' } },
    { $unwind: '$complaint' },
    { $match: { volunteer: { $in: volunteers.map((volunteer) => volunteer._id) } } },
    {
      $group: {
        _id: '$volunteer',
        eligibleAssignments: { $sum: { $cond: [{ $ne: ['$complaint.status', 'rejected'] }, 1, 0] } },
        resolvedAssignments: { $sum: { $cond: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, 1, 0] } },
        activeComplaints: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$isActive', true] }, { $in: ['$complaint.status', ACTIVE_STATUSES] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  const statsByVolunteer = new Map(performance.map((stats) => [String(stats._id), stats]));
  const complaintPoint = complaint.location?.coordinates
    || [complaint.longitude, complaint.latitude];

  return volunteers.map((volunteer) => {
    const stats = statsByVolunteer.get(String(volunteer._id)) || {};
    const activeComplaints = stats.activeComplaints || 0;
    const eligibleAssignments = stats.eligibleAssignments || 0;
    const resolvedAssignments = stats.resolvedAssignments || 0;
    const resolutionRate = eligibleAssignments
      ? round((resolvedAssignments / eligibleAssignments) * 100)
      : 50;
    const expertiseCategories = volunteer.expertiseCategories || [];
    const categoryExpertise = expertiseCategories.includes(complaint.category);
    const distanceKm = distanceInKm(complaintPoint, volunteer.location?.coordinates);
    const scoreParts = {
      categoryExpertise: categoryExpertise ? 100 : expertiseCategories.length ? 0 : 20,
      workload: Math.max(0, 100 - activeComplaints * 15),
      resolutionRate,
      distance: distanceKm === null ? 50 : Math.max(0, 100 - Math.min(distanceKm, 100))
    };
    const score = round(
      scoreParts.categoryExpertise * 0.4
      + scoreParts.workload * 0.25
      + scoreParts.resolutionRate * 0.2
      + scoreParts.distance * 0.15
    );

    return {
      volunteerId: volunteer._id,
      name: volunteer.name,
      email: volunteer.email,
      score,
      assignedComplaints: eligibleAssignments,
      scoreBreakdown: scoreParts,
      expertiseCategories,
      activeComplaints,
      resolutionRate,
      distanceKm: distanceKm === null ? null : round(distanceKm)
    };
  }).sort((left, right) => right.score - left.score || left.activeComplaints - right.activeComplaints || left.name.localeCompare(right.name));
}

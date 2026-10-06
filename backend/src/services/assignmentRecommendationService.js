import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';

const RESOLVED_STATUSES = ['resolved', 'closed'];
const ACTIVE_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress'];
const MAX_NEARBY_VOLUNTEERS = 200;
const MAX_DISTANCE_KM = 50;
const EARTH_RADIUS_KM = 6371;

function recommendationError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function distanceInKm(from, to) {
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

function availabilityScore(availability) {
  if (['available', 'full_time', 'flexible'].includes(availability)) return 100;
  if (['limited', 'part_time', 'weekend'].includes(availability)) return 60;
  if (availability === 'unavailable') return 0;
  return 75;
}

async function nearbyVolunteers(complaintPoint, complaintId) {
  if (!complaintPoint) return User.find({ role: 'volunteer', isActive: true })
    .select('name email phone area city availability expertiseCategories location').limit(MAX_NEARBY_VOLUNTEERS).lean();

  let located;
  try {
    located = await User.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: complaintPoint },
          key: 'location',
          distanceField: 'distanceMeters',
          spherical: true,
          query: { role: 'volunteer', isActive: true }
        }
      },
      { $limit: MAX_NEARBY_VOLUNTEERS },
      { $project: { name: 1, email: 1, phone: 1, area: 1, city: 1, availability: 1, expertiseCategories: 1, location: 1, distanceMeters: 1 } }
    ]);
  } catch (error) {
    console.error('[assignment-recommendations] $geoNear aggregation failed; using non-geospatial fallback', {
      complaintId: String(complaintId),
      errorName: error.name,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack
    });
    try {
      located = await User.find({ role: 'volunteer', isActive: true, location: { $exists: true, $ne: null } })
        .select('name email phone area city availability expertiseCategories location')
        .limit(MAX_NEARBY_VOLUNTEERS)
        .lean();
    } catch (fallbackError) {
      console.error('[assignment-recommendations] Volunteer fallback query failed', {
        complaintId: String(complaintId),
        errorName: fallbackError.name,
        errorCode: fallbackError.code,
        errorMessage: fallbackError.message,
        stack: fallbackError.stack
      });
      return [];
    }
  }
  const unlocated = located.length < MAX_NEARBY_VOLUNTEERS
    ? await User.find({ role: 'volunteer', isActive: true, $or: [{ location: { $exists: false } }, { location: null }] })
      .select('name email phone area city availability expertiseCategories location').limit(MAX_NEARBY_VOLUNTEERS - located.length).lean()
    : [];
  return [...located, ...unlocated];
}

export async function recommendVolunteers(complaintId, { limit } = {}) {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw recommendationError('Complaint id must be valid', 400, 'VALIDATION_ERROR');
  }
  const complaint = await Complaint.findById(complaintId).lean();
  if (!complaint) throw recommendationError('Complaint not found', 404, 'NOT_FOUND');
  if (complaint.status !== 'under_review') {
    throw recommendationError('Volunteer recommendations are available for complaints under review', 409, 'INVALID_STATUS');
  }

  const complaintPoint = complaint.location?.coordinates || (Number.isFinite(complaint.longitude) && Number.isFinite(complaint.latitude)
    ? [complaint.longitude, complaint.latitude]
    : null);
  const volunteers = await nearbyVolunteers(complaintPoint, complaint._id);
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
        activeAssignments: {
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

  const recommendations = volunteers.map((volunteer) => {
    const stats = statsByVolunteer.get(String(volunteer._id)) || {};
    const activeAssignments = stats.activeAssignments || 0;
    const eligibleAssignments = stats.eligibleAssignments || 0;
    const resolvedAssignments = stats.resolvedAssignments || 0;
    const resolutionRate = eligibleAssignments ? round((resolvedAssignments / eligibleAssignments) * 100) : 50;
    const distanceKm = Number.isFinite(volunteer.distanceMeters)
      ? volunteer.distanceMeters / 1000
      : distanceInKm(complaintPoint, volunteer.location?.coordinates);
    const parts = {
      distance: distanceKm === null ? 0 : Math.max(0, 100 * (1 - Math.min(distanceKm, MAX_DISTANCE_KM) / MAX_DISTANCE_KM)),
      activeAssignments: Math.max(0, 100 - activeAssignments * 10),
      resolutionRate,
      availability: availabilityScore(volunteer.availability)
    };
    const score = round(parts.distance * 0.5 + parts.activeAssignments * 0.25 + parts.resolutionRate * 0.15 + parts.availability * 0.1);
    const volunteerDetails = {
      _id: volunteer._id,
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone || '',
      area: volunteer.area || '',
      city: volunteer.city || '',
      availability: volunteer.availability || 'available'
    };
    return {
      volunteer: volunteerDetails,
      volunteerId: volunteer._id,
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone || '',
      area: volunteer.area || '',
      city: volunteer.city || '',
      availability: volunteer.availability || 'available',
      distanceKm: distanceKm === null ? null : round(distanceKm),
      activeAssignments,
      activeComplaints: activeAssignments,
      assignedComplaints: eligibleAssignments,
      resolutionRate,
      score,
      scoreBreakdown: parts,
      expertiseCategories: volunteer.expertiseCategories || []
    };
  }).sort((left, right) => right.score - left.score || left.activeAssignments - right.activeAssignments || left.name.localeCompare(right.name));
  return Number.isInteger(limit) ? recommendations.slice(0, limit) : recommendations;
}

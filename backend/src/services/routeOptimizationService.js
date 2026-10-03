import Assignment from '../models/Assignment.js';
import User from '../models/User.js';

const EARTH_RADIUS_KM = 6371;
export const WALKING_SPEED_KMH = 4.5;

export function haversineDistanceKm(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return null;
  const [longitude1, latitude1] = from;
  const [longitude2, latitude2] = to;
  if (![longitude1, latitude1, longitude2, latitude2].every(Number.isFinite)) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function optimizeVisitOrder(assignments, startingPoint) {
  const pending = assignments.map((assignment, index) => ({ ...assignment, _inputOrder: index }));
  const ordered = [];
  let currentPoint = startingPoint;
  let totalDistanceKm = 0;
  while (pending.length) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    if (currentPoint) {
      pending.forEach((assignment, index) => {
        const position = assignment.complaint?.location?.coordinates;
        const distance = haversineDistanceKm(currentPoint, position);
        if (distance !== null && distance < nearestDistance) {
          nearestIndex = index;
          nearestDistance = distance;
        }
      });
    }
    if (nearestIndex < 0) nearestIndex = 0;
    const [next] = pending.splice(nearestIndex, 1);
    const position = next.complaint?.location?.coordinates;
    const legDistanceKm = currentPoint ? haversineDistanceKm(currentPoint, position) : null;
    if (legDistanceKm !== null) totalDistanceKm += legDistanceKm;
    ordered.push({ ...next, routeOrder: ordered.length + 1, legDistanceKm: legDistanceKm === null ? null : Math.round(legDistanceKm * 10) / 10 });
    if (position) currentPoint = position;
  }
  const distance = Math.round(totalDistanceKm * 10) / 10;
  return {
    assignments: ordered,
    totalDistanceKm: distance,
    estimatedTravelMinutes: Math.ceil((totalDistanceKm / WALKING_SPEED_KMH) * 60),
    startingPoint: startingPoint ? { latitude: startingPoint[1], longitude: startingPoint[0] } : null,
    travelMode: 'walking-estimate'
  };
}

export async function getVolunteerRoute(volunteerId, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const [volunteer, assignments] = await Promise.all([
    User.findById(volunteerId).select('name location').lean(),
    Assignment.find({ volunteer: volunteerId, isActive: true, assignedAt: { $gte: start, $lt: end } })
      .populate({ path: 'complaint', select: 'title category status address latitude longitude location priority' })
      .sort({ assignedAt: 1 }).lean()
  ]);
  const startPoint = volunteer?.location?.coordinates || null;
  const route = optimizeVisitOrder(assignments.filter((item) => item.complaint), startPoint);
  return {
    date: start.toISOString().slice(0, 10),
    volunteerPosition: startPoint ? { latitude: startPoint[1], longitude: startPoint[0] } : null,
    ...route
  };
}

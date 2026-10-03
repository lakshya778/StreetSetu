import Complaint from '../models/Complaint.js';
import User from '../models/User.js';

const MAX_HEATMAP_POINTS = 5000;
const HOTSPOT_MINIMUM_REPORTS = 3;

function buildMatch(query = {}, statusOverride) {
  const match = { location: { $type: 'object' } };
  const status = statusOverride ?? query.status;
  if (status) match.status = status;
  if (query.category) match.category = query.category;
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }
  return match;
}

function standardizeLocation() {
  const addressParts = { $split: [{ $ifNull: ['$address', ''] }, ','] };
  return {
    $set: {
      _areaName: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$area', ''] } }, 0] }, '$area', { $trim: { input: { $arrayElemAt: [addressParts, 0] } } }] },
      _cityName: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$city', ''] } }, 0] }, '$city', { $trim: { input: { $arrayElemAt: [addressParts, -3] } } }] },
      _latitude: { $arrayElemAt: ['$location.coordinates', 1] },
      _longitude: { $arrayElemAt: ['$location.coordinates', 0] }
    }
  };
}

function asNamedCounts(rows, key = 'name') {
  return rows.map(({ _id, count }) => ({ [key]: _id || (key === 'city' ? 'Unknown city' : 'Unknown area'), count }));
}

export async function getHeatmap(query = {}) {
  const match = buildMatch(query, query.kind === 'resolved' ? { $in: ['resolved', 'closed'] } : query.kind === 'rejected' ? 'rejected' : undefined);
  const [zones, count] = await Promise.all([
    Complaint.aggregate([
      { $match: match }, standardizeLocation(),
      { $group: { _id: { latitude: { $round: ['$_latitude', 3] }, longitude: { $round: ['$_longitude', 3] } }, latitude: { $avg: '$_latitude' }, longitude: { $avg: '$_longitude' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: MAX_HEATMAP_POINTS },
      { $project: { _id: 0, latitude: 1, longitude: 1, count: 1 } }
    ]),
    Complaint.countDocuments(match)
  ]);
  const strongestZone = zones[0]?.count || 1;
  return { points: zones.map((zone) => ({ ...zone, intensity: zone.count / strongestZone })), count, zoneCount: zones.length, limit: MAX_HEATMAP_POINTS };
}

async function aggregatePlaces(match, key) {
  const rows = await Complaint.aggregate([
    { $match: match }, standardizeLocation(),
    { $group: { _id: key === 'city' ? '$_cityName' : '$_areaName', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }, { $limit: 25 }
  ]);
  return asNamedCounts(rows, key);
}

async function aggregateCategoryStatus(match, key) {
  const rows = await Complaint.aggregate([
    { $match: match },
    { $group: { _id: key === 'category' ? '$category' : '$status', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);
  return rows.map(({ _id, count }) => ({ [key]: _id, count }));
}

export async function getGeoSummary(query = {}) {
  const match = buildMatch(query);
  const [cities, areas, categories, statuses, volunteerCoverage] = await Promise.all([
    aggregatePlaces(match, 'city'), aggregatePlaces(match, 'area'),
    aggregateCategoryStatus(match, 'category'), aggregateCategoryStatus(match, 'status'),
    User.aggregate([
      { $match: { role: 'volunteer', isActive: true, 'location.type': 'Point', 'location.coordinates.0': { $exists: true }, 'location.coordinates.1': { $exists: true } } },
      { $project: { _id: 1, name: 1, area: 1, city: 1, location: 1 } },
      { $sort: { name: 1 } }, { $limit: 500 }
    ])
  ]);
  return { cities, areas, categories, statuses, volunteerCoverage: volunteerCoverage.map((volunteer) => ({
    _id: volunteer._id,
    name: volunteer.name,
    area: volunteer.area || '',
    city: volunteer.city || '',
    latitude: volunteer.location.coordinates[1],
    longitude: volunteer.location.coordinates[0]
  })) };
}

async function getZones(match) {
  return Complaint.aggregate([
    { $match: match }, standardizeLocation(),
    { $group: { _id: { latitude: { $round: ['$_latitude', 3] }, longitude: { $round: ['$_longitude', 3] } }, count: { $sum: 1 }, latitude: { $avg: '$_latitude' }, longitude: { $avg: '$_longitude' }, area: { $first: '$_areaName' } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, zone: { $concat: [{ $toString: '$_id.latitude' }, ', ', { $toString: '$_id.longitude' }] }, latitude: 1, longitude: 1, area: 1, count: 1 } }
  ]);
}

async function getAreaHotspots(match) {
  return Complaint.aggregate([
    { $match: match }, standardizeLocation(),
    { $group: { _id: '$_areaName', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }, { $limit: 10 },
    { $project: { _id: 0, area: { $ifNull: ['$_id', 'Unknown area'] }, count: 1 } }
  ]);
}

export async function getHotspots(query = {}) {
  const match = buildMatch({ ...query, status: undefined });
  const [zones, activeZones, reportedAreas, resolvedAreas, rejectedAreas, trend] = await Promise.all([
    getZones(match),
    getZones({ ...match, status: { $in: ['submitted', 'under_review', 'assigned', 'in_progress'] } }),
    getAreaHotspots(match),
    getAreaHotspots({ ...match, status: { $in: ['resolved', 'closed'] } }),
    getAreaHotspots({ ...match, status: 'rejected' }),
    Complaint.aggregate([
      { $match: match }, standardizeLocation(),
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, latitude: { $round: ['$_latitude', 3] }, longitude: { $round: ['$_longitude', 3] } }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.month', complaints: { $sum: '$count' }, activeHotspots: { $sum: { $cond: [{ $gte: ['$count', HOTSPOT_MINIMUM_REPORTS] }, 1, 0] } } } },
      { $sort: { _id: 1 } }, { $project: { _id: 0, month: '$_id', complaints: 1, activeHotspots: 1 } }
    ])
  ]);
  const activeHotspotCount = activeZones.filter((zone) => zone.count >= HOTSPOT_MINIMUM_REPORTS).length;
  const hottestZoneCount = activeZones[0]?.count || 0;
  return {
    topZones: zones.slice(0, 10),
    categoryHotspots: await Complaint.aggregate([
      { $match: match },
      { $group: { _id: { category: '$category', latitude: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 3] }, longitude: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 3] } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
      { $project: { _id: 0, category: '$_id.category', latitude: '$_id.latitude', longitude: '$_id.longitude', count: 1 } }
    ]),
    reportedAreas, resolvedAreas, rejectedAreas, trend,
    metrics: { heatmapScore: Math.min(100, hottestZoneCount * 10), activeHotspotCount }
  };
}

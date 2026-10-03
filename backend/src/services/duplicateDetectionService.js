import Complaint from '../models/Complaint.js';
import Vote from '../models/Vote.js';

export const DUPLICATE_CONFIDENCE_THRESHOLD = 0.62;
export const DUPLICATE_SEARCH_RADIUS_METERS = 300;

function normalize(text = '') {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter((token) => token.length > 1).join(' ');
}

function tokenSimilarity(left, right) {
  const a = new Set(normalize(left).split(' ').filter(Boolean));
  const b = new Set(normalize(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  const jaccard = overlap / (a.size + b.size - overlap);
  const dice = (2 * overlap) / (a.size + b.size);
  return (jaccard + dice) / 2;
}

function editSimilarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return Math.max(0, 1 - previous[b.length] / Math.max(a.length, b.length));
}

export function textSimilarity(left, right) {
  return Math.max(tokenSimilarity(left, right), editSimilarity(left, right));
}

export function distanceMeters([lon1, lat1], [lon2, lat2]) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function scoreDuplicate(payload, existing) {
  const distance = distanceMeters([payload.longitude, payload.latitude], existing.location.coordinates);
  const locationScore = Math.max(0, 1 - distance / DUPLICATE_SEARCH_RADIUS_METERS);
  const categoryScore = payload.category === existing.category ? 1 : 0;
  const titleScore = textSimilarity(payload.title, existing.title);
  const descriptionScore = tokenSimilarity(payload.description, existing.description);
  const confidence = Math.round((categoryScore * 0.15 + titleScore * 0.35 + descriptionScore * 0.3 + locationScore * 0.2) * 100);
  return { confidence, distanceMeters: Math.round(distance), titleSimilarity: Math.round(titleScore * 100), descriptionSimilarity: Math.round(descriptionScore * 100) };
}

export async function findDuplicateCandidates(payload, { limit = 5 } = {}) {
  const nearby = await Complaint.find({
    status: { $ne: 'rejected' },
    location: { $geoWithin: { $centerSphere: [[payload.longitude, payload.latitude], DUPLICATE_SEARCH_RADIUS_METERS / 6371000] } }
  }).select('_id title description category status location address createdAt supporterCount').sort({ createdAt: -1 }).limit(100).lean();
  const voteCounts = await Vote.aggregate([
    { $match: { complaint: { $in: nearby.map((complaint) => complaint._id) } } },
    { $group: { _id: '$complaint', count: { $sum: 1 } } }
  ]);
  const votesByComplaint = new Map(voteCounts.map((item) => [String(item._id), item.count]));

  return nearby.map((complaint) => ({
    complaint: { ...complaint, supporterCount: votesByComplaint.get(String(complaint._id)) || 0 },
    ...scoreDuplicate(payload, complaint)
  })).filter((candidate) => candidate.confidence >= 35)
    .sort((a, b) => b.confidence - a.confidence || a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

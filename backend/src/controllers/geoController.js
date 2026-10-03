import { discoverNearbyComplaints, findNearbyComplaints } from '../services/geoService.js';

export async function nearbyComplaints(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await findNearbyComplaints(req.geoQuery, req)
    });
  } catch (error) {
    return next(error);
  }
}

export async function discoverNearby(req, res, next) {
  try {
    return res.json({ success: true, data: await discoverNearbyComplaints(req.geoQuery), message: 'Nearby complaints found' });
  } catch (error) { return next(error); }
}

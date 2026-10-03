import { getGeoSummary, getHeatmap, getHotspots } from '../services/geoAnalyticsService.js';

export async function heatmap(req, res, next) {
  try { return res.json({ success: true, data: await getHeatmap(req.geoAnalyticsQuery) }); }
  catch (error) { return next(error); }
}

export async function hotspots(req, res, next) {
  try { return res.json({ success: true, data: await getHotspots(req.geoAnalyticsQuery) }); }
  catch (error) { return next(error); }
}

export async function geoSummary(req, res, next) {
  try { return res.json({ success: true, data: await getGeoSummary(req.geoAnalyticsQuery) }); }
  catch (error) { return next(error); }
}

import { getDashboardSummary } from '../services/dashboardService.js';

export async function summary(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await getDashboardSummary(req.dashboardQuery, req)
    });
  } catch (error) {
    return next(error);
  }
}

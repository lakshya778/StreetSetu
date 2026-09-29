import { exportComplaintsCsv, exportComplaintsPdf } from '../services/reportService.js';

export async function csv(req, res, next) {
  try {
    const report = await exportComplaintsCsv({ ...req.query, ...req.dashboardQuery }, req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="streetsetu-complaints-report.csv"');
    res.setHeader('X-Report-Total', String(report.total));
    return res.send(`\uFEFF${report.content}`);
  } catch (error) { return next(error); }
}

export async function pdf(req, res, next) {
  try { return await exportComplaintsPdf({ ...req.query, ...req.dashboardQuery }, req, res); }
  catch (error) { return next(error); }
}

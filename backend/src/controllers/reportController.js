import { exportAdminPdf, exportAnalyticsCsv, exportComplaintsCsv, exportComplaintsPdf, exportMonthlyPdf, exportVolunteerPdf, exportVolunteersCsv } from '../services/reportService.js';

function sendCsv(res, report, fileName) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('X-Report-Total', String(report.total));
  return res.send(`\uFEFF${report.content}`);
}

export async function csv(req, res, next) {
  try {
    return sendCsv(res, await exportComplaintsCsv({ ...req.query, ...req.dashboardQuery }, req), 'streetsetu-complaints-report.csv');
  } catch (error) { return next(error); }
}

export async function pdf(req, res, next) {
  try { return await exportComplaintsPdf({ ...req.query, ...req.dashboardQuery }, req, res); }
  catch (error) { return next(error); }
}

export async function volunteersCsv(req, res, next) {
  try { return sendCsv(res, await exportVolunteersCsv(), 'streetsetu-volunteers-report.csv'); }
  catch (error) { return next(error); }
}

export async function analyticsCsv(req, res, next) {
  try { return sendCsv(res, await exportAnalyticsCsv(req.dashboardQuery, req), 'streetsetu-analytics-report.csv'); }
  catch (error) { return next(error); }
}

export async function monthlyPdf(req, res, next) {
  try { return await exportMonthlyPdf(req.query.month, req, res); }
  catch (error) { return next(error); }
}

export async function adminPdf(req, res, next) {
  try { return await exportAdminPdf(req.dashboardQuery, req, res); }
  catch (error) { return next(error); }
}

export async function volunteerPdf(req, res, next) {
  try { return await exportVolunteerPdf(req.query.volunteerId, res); }
  catch (error) { return next(error); }
}

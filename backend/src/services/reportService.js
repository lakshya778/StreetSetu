import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Assignment from '../models/Assignment.js';
import { listComplaints } from './complaintService.js';
import { getDashboardSummary } from './dashboardService.js';
import { getGeoSummary, getHotspots } from './geoAnalyticsService.js';

const RESOLVED_STATUSES = ['resolved', 'closed'];

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportComplaintsCsv(query, req) {
  const result = await listComplaints({ ...query, page: 1, limit: 5000 }, req);
  const columns = ['id', 'title', 'category', 'priority', 'status', 'address', 'latitude', 'longitude', 'createdAt', 'resolvedAt', 'rejectionReason'];
  const lines = [columns.join(','), ...result.items.map((item) => [
    item._id, item.title, item.category, item.priority, item.status, item.address,
    item.latitude, item.longitude, item.createdAt?.toISOString(), item.resolvedAt?.toISOString(), item.rejectionReason
  ].map(csvCell).join(','))];
  return { content: lines.join('\r\n'), total: result.total, exported: result.items.length };
}

export async function exportComplaintsPdf(query, req, response) {
  const result = await listComplaints({ ...query, page: 1, limit: 500 }, req);
  const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="streetsetu-complaints-report.pdf"');
  document.pipe(response);
  document.fontSize(20).fillColor('#284c3d').text('StreetSetu Complaints Report');
  document.moveDown(0.3).fontSize(9).fillColor('#687a70').text(`Generated ${new Date().toLocaleString('en-IN')} · ${result.total} matching complaints (first ${result.items.length})`);
  document.moveDown();
  result.items.forEach((complaint, index) => {
    if (document.y > 720) document.addPage();
    document.fontSize(11).fillColor('#293c33').text(`${index + 1}. ${complaint.title}`, { continued: true });
    document.fontSize(9).fillColor('#64746b').text(`  ${complaint.status} · ${complaint.category} · ${complaint.priority}`);
    document.fontSize(8).fillColor('#65756c').text(`${complaint.address || 'No address'} | ${complaint.latitude}, ${complaint.longitude}`);
    if (complaint.rejectionReason) document.text(`Rejection reason: ${complaint.rejectionReason}`);
    document.moveDown(0.55);
  });
  document.end();
}

function csvResponse(content, total) { return { content, total }; }

export async function exportVolunteersCsv() {
  const [volunteers, performance] = await Promise.all([
    User.find({ role: 'volunteer' }).select('name email phone city area availability isActive').sort({ name: 1 }).limit(5000).lean(),
    Assignment.aggregate([
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'complaint' } },
      { $unwind: '$complaint' },
      { $group: {
        _id: '$volunteer',
        totalAssignments: { $sum: 1 },
        activeAssignments: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $in: ['$complaint.status', ['submitted', 'under_review', 'assigned', 'in_progress']] }] }, 1, 0] } },
        resolvedAssignments: { $sum: { $cond: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, 1, 0] } },
        rejectedAssignments: { $sum: { $cond: [{ $eq: ['$complaint.status', 'rejected'] }, 1, 0] } },
        averageCompletionMs: { $avg: { $cond: [{ $and: [{ $in: ['$complaint.status', RESOLVED_STATUSES] }, { $ne: ['$complaint.resolvedAt', null] }] }, { $subtract: ['$complaint.resolvedAt', '$complaint.createdAt'] }, null] } }
      } }
    ])
  ]);
  const byId = new Map(performance.map((row) => [String(row._id), row]));
  const columns = ['volunteerId', 'name', 'email', 'phone', 'city', 'area', 'availability', 'activeAssignments', 'totalAssignments', 'resolvedAssignments', 'resolutionRate', 'averageCompletionDays', 'active'];
  const lines = [columns.join(','), ...volunteers.map((volunteer) => {
    const stats = byId.get(String(volunteer._id)) || {};
    const eligibleAssignments = Math.max((stats.totalAssignments || 0) - (stats.rejectedAssignments || 0), 0);
    const resolutionRate = eligibleAssignments ? Math.round((stats.resolvedAssignments / eligibleAssignments) * 10000) / 100 : 0;
    const averageCompletionDays = stats.averageCompletionMs == null ? '' : Math.round((stats.averageCompletionMs / 86400000) * 10) / 10;
    return [volunteer._id, volunteer.name, volunteer.email, volunteer.phone, volunteer.city, volunteer.area, volunteer.availability, stats.activeAssignments || 0, stats.totalAssignments || 0, stats.resolvedAssignments || 0, resolutionRate, averageCompletionDays, volunteer.isActive].map(csvCell).join(',');
  })];
  return csvResponse(lines.join('\r\n'), volunteers.length);
}

export async function exportAnalyticsCsv(query, req) {
  const summary = await getDashboardSummary(query, req);
  const lines = [['section', 'metric', 'value'].map(csvCell).join(',')];
  const metrics = ['totalComplaints', 'openComplaints', 'resolvedComplaints', 'rejectedComplaints', 'rejectionRate', 'duplicatesPrevented', 'duplicateSupportCount', 'averageResponseDistanceKm', 'assignmentEfficiency', 'averageCompletionDays', 'complaintsCompletedPerKm', 'routeEfficiencyScore'];
  metrics.forEach((key) => lines.push(['overview', key, summary[key]].map(csvCell).join(',')));
  summary.monthlyTrends.forEach((row) => lines.push(['monthly', row.month, `submitted=${row.submitted};resolved=${row.resolved};rejected=${row.rejected}`].map(csvCell).join(',')));
  summary.categoryCounts.forEach((row) => lines.push(['category', row.category, row.count].map(csvCell).join(',')));
  summary.statusCounts.forEach((row) => lines.push(['status', row.status, row.count].map(csvCell).join(',')));
  return csvResponse(lines.join('\r\n'), lines.length - 1);
}

function sendSummaryPdf(response, title, subtitle, rows) {
  const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf"`);
  document.pipe(response);
  document.fontSize(20).fillColor('#284c3d').text(`StreetSetu ${title}`);
  document.moveDown(0.3).fontSize(9).fillColor('#687a70').text(`${subtitle} · Generated ${new Date().toLocaleString('en-IN')}`);
  document.moveDown();
  rows.forEach((row) => {
    if (document.y > 730) document.addPage();
    document.fontSize(11).fillColor('#293c33').text(row.label);
    if (row.value !== undefined) document.fontSize(9).fillColor('#64746b').text(String(row.value));
    document.moveDown(0.45);
  });
  document.end();
}

function dateRangeForMonth(month) {
  const value = typeof month === 'string' ? month : new Date().toISOString().slice(0, 7);
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) {
    const error = new Error('Month must use YYYY-MM format');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return { fromDate: new Date(Date.UTC(year, monthIndex, 1)), toDate: new Date(Date.UTC(year, monthIndex + 1, 1) - 1), month: value };
}

export async function exportMonthlyPdf(month, req, response) {
  const dateRange = dateRangeForMonth(month);
  const summary = await getDashboardSummary(dateRange, req);
  const rows = [
    { label: 'Complaint totals', value: `Reported ${summary.totalComplaints} · resolved ${summary.resolvedComplaints} · active ${summary.openComplaints} · rejected ${summary.rejectedComplaints}` },
    { label: 'Resolution rate', value: `${summary.totalComplaints ? Math.round((summary.resolvedComplaints / summary.totalComplaints) * 100) : 0}% · ${summary.rejectionRate}% rejection rate` },
    ...summary.categoryCounts.map((row) => ({ label: `Category: ${row.category}`, value: `${row.count} reports` })),
    ...summary.monthlyTrends.map((row) => ({ label: `Month: ${row.month}`, value: `${row.submitted} submitted · ${row.resolved} resolved · ${row.rejected} rejected` }))
  ];
  sendSummaryPdf(response, 'Monthly Report', dateRange.month, rows);
}

export async function exportAdminPdf(query, req, response) {
  const geoQuery = { from: query?.fromDate, to: query?.toDate };
  const [summary, geo, hotspots] = await Promise.all([getDashboardSummary(query, req), getGeoSummary(geoQuery), getHotspots(geoQuery)]);
  const rows = [
    { label: 'Executive overview', value: `${summary.totalComplaints} complaints · ${summary.resolvedComplaints} resolved · ${summary.openComplaints} active · ${summary.rejectedComplaints} rejected` },
    { label: 'Duplicate prevention', value: `${summary.duplicatesPrevented} complaints supported to prevent duplicates · ${summary.duplicateSupportCount} support actions` },
    { label: 'Volunteer assignment', value: `Average response distance ${summary.averageResponseDistanceKm ?? 'unknown'} km · assignment efficiency ${summary.assignmentEfficiency}%` },
    ...summary.volunteerPerformance.slice(0, 10).map((volunteer, index) => ({ label: `Volunteer #${index + 1}: ${volunteer.volunteerName}`, value: `${volunteer.resolvedComplaints} resolved · ${volunteer.resolutionRate}% resolution rate · ${volunteer.averageCompletionDays ?? 'n/a'} days average` })),
    ...hotspots.topZones.slice(0, 10).map((zone, index) => ({ label: `Complaint zone #${index + 1}: ${zone.zone}`, value: `${zone.count} reports` })),
    ...geo.areas.slice(0, 8).map((area) => ({ label: `Active area: ${area.area}`, value: `${area.count} reports` }))
  ];
  sendSummaryPdf(response, 'Admin Report', 'Executive city operations report', rows);
}

export async function exportVolunteerPdf(volunteerId, response) {
  if (!mongoose.isValidObjectId(volunteerId)) {
    const error = new Error('Volunteer id must be valid');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const [volunteer, assignments] = await Promise.all([
    User.findOne({ _id: volunteerId, role: 'volunteer' }).select('name email city area').lean(),
    Assignment.find({ volunteer: volunteerId }).populate('complaint', 'title status createdAt resolvedAt').sort({ assignedAt: -1 }).limit(500).lean()
  ]);
  if (!volunteer) {
    const error = new Error('Volunteer not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  const resolved = assignments.filter(({ complaint }) => RESOLVED_STATUSES.includes(complaint?.status));
  const rejectedCount = assignments.filter(({ complaint }) => complaint?.status === 'rejected').length;
  const eligibleCount = Math.max(assignments.length - rejectedCount, 0);
  const durations = resolved.filter(({ complaint }) => complaint.resolvedAt).map(({ complaint }) => complaint.resolvedAt - complaint.createdAt);
  const avgDays = durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length / 86400000) * 10) / 10 : 'n/a';
  const completedDistanceKm = resolved.reduce((sum, assignment) => sum + (assignment.distanceKm || 0), 0);
  const completedPerKm = completedDistanceKm ? Math.round((resolved.length / completedDistanceKm) * 100) / 100 : 0;
  const routeEfficiencyScore = Math.min(100, Math.round(completedPerKm * 10));
  const rows = [
    { label: 'Volunteer', value: volunteer.name },
    { label: 'Location', value: [volunteer.area, volunteer.city].filter(Boolean).join(', ') || 'Not provided' },
    { label: 'Performance', value: `${assignments.length} assignments · ${resolved.length} resolved · ${eligibleCount ? Math.round((resolved.length / eligibleCount) * 100) : 0}% resolution rate · ${avgDays} days average completion` },
    { label: 'Route efficiency', value: `${completedPerKm} completed complaints/km · score ${routeEfficiencyScore}%` },
    ...assignments.map(({ complaint }) => ({ label: complaint?.title || 'Complaint unavailable', value: `${complaint?.status || 'unknown'} · ${complaint?.createdAt ? new Date(complaint.createdAt).toLocaleDateString('en-IN') : ''}` }))
  ];
  sendSummaryPdf(response, 'Volunteer Report', volunteer.name, rows);
}

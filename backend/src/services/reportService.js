import PDFDocument from 'pdfkit';
import { listComplaints } from './complaintService.js';

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

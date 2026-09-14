const Complaint = require('../models/Complaint');
const Location = require('../models/Location');
const User = require('../models/User');
const logger = require('../config/logger');

async function createComplaint(payload, user) {
  const { title, description, category, departmentId, wardId, neighbourhoodId, location, addressText, imageUrls = [], videoUrls = [] } = payload;

  if (!title || !description || !category || !wardId || !location) {
    const error = new Error('title, description, category, wardId and location are required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const complaintNumber = `CS-${Date.now().toString(36).toUpperCase()}`;

  const complaint = await Complaint.create({
    complaintNumber,
    title,
    description,
    category,
    departmentId,
    wardId,
    neighbourhoodId,
    locationId: location.locationId || null,
    reporterUserId: user?.id || user?._id || null,
    assignedToUserId: null,
    status: 'submitted',
    priority: 'medium',
    severity: 'medium',
    source: 'citizen',
    addressText,
    imageUrls,
    videoUrls,
    location: {
      type: 'Point',
      coordinates: location.coordinates || [0, 0],
    },
    createdBy: user?.id || user?._id || null,
    updatedBy: user?.id || user?._id || null,
  });

  logger.info(`Complaint created ${complaint.complaintNumber}`);

  return complaint;
}

async function uploadImage(complaintId, file) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const imageUrl = file?.url || file?.path || 'https://example.invalid/media/uploaded-image';
  complaint.imageUrls = [...new Set([...(complaint.imageUrls || []), imageUrl])];
  complaint.updatedAt = new Date();
  await complaint.save();

  return complaint;
}

async function getComplaint(id) {
  const complaint = await Complaint.findById(id).populate('wardId').populate('locationId').populate('reporterUserId');
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return complaint;
}

async function listComplaints(query = {}) {
  return Complaint.find(query).sort({ createdAt: -1 }).limit(50);
}

async function updateStatus(id, status) {
  const complaint = await Complaint.findById(id);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!['submitted', 'reviewed', 'assigned', 'in_progress', 'resolved', 'rejected', 'escalated'].includes(status)) {
    const error = new Error('Invalid complaint status');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  complaint.status = status;
  complaint.updatedAt = new Date();
  await complaint.save();

  return complaint;
}

module.exports = {
  createComplaint,
  uploadImage,
  getComplaint,
  listComplaints,
  updateStatus,
};

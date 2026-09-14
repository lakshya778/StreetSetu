const complaintService = require('../services/complaintService');
const { responseFormatter } = require('../utils/responseFormatter');

async function createComplaint(req, res, next) {
  try {
    const complaint = await complaintService.createComplaint(req.body, req.user || { id: req.user?.id || null });
    return responseFormatter(res, 201, complaint, 'Complaint created successfully');
  } catch (error) {
    return next(error);
  }
}

async function uploadImage(req, res, next) {
  try {
    const complaint = await complaintService.uploadImage(req.params.id, req.file || req.body);
    return responseFormatter(res, 200, complaint, 'Image uploaded successfully');
  } catch (error) {
    return next(error);
  }
}

async function getComplaint(req, res, next) {
  try {
    const complaint = await complaintService.getComplaint(req.params.id);
    return responseFormatter(res, 200, complaint, 'Complaint retrieved successfully');
  } catch (error) {
    return next(error);
  }
}

async function listComplaints(req, res, next) {
  try {
    const complaints = await complaintService.listComplaints(req.query);
    return responseFormatter(res, 200, complaints, 'Complaints retrieved successfully');
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const complaint = await complaintService.updateStatus(req.params.id, req.body.status);
    return responseFormatter(res, 200, complaint, 'Complaint status updated');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createComplaint,
  uploadImage,
  getComplaint,
  listComplaints,
  updateStatus,
};

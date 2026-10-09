import {
  assignComplaint,
  listMyAssignments,
  reassignComplaint,
  respondToAssignment,
  updateAssignedStatus
} from '../services/assignmentService.js';
import { recommendVolunteers } from '../services/assignmentRecommendationService.js';
import { getVolunteerRoute } from '../services/routeOptimizationService.js';
import { getCompletionVerification, listCompletionVerifications, reviewCompletionVerification } from '../services/completionVerificationService.js';
import gamificationService from '../services/gamificationService.js';

export async function assign(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await assignComplaint(req.params.complaintId, req.body.volunteerId, req, { recommendationAccepted: req.body.recommendationAccepted }), message: 'Complaint assigned successfully' });
  } catch (error) { return next(error); }
}

export async function recommendations(req, res, next) {
  try {
    return res.json({ success: true, data: await recommendVolunteers(req.params.complaintId), message: 'Volunteer recommendations generated successfully' });
  } catch (error) { return next(error); }
}

export async function recommendTop(req, res, next) {
  try {
    return res.json({ success: true, data: await recommendVolunteers(req.params.complaintId, { limit: 5 }), message: 'Top volunteer recommendations generated successfully' });
  } catch (error) { return next(error); }
}

export async function myRoute(req, res, next) {
  try {
    return res.json({ success: true, data: await getVolunteerRoute(req.user.sub), message: 'Today’s route optimized successfully' });
  } catch (error) { return next(error); }
}

export async function reassign(req, res, next) {
  try {
    return res.json({ success: true, data: await reassignComplaint(req.params.complaintId, req.body.volunteerId, req), message: 'Complaint reassigned successfully' });
  } catch (error) { return next(error); }
}

export async function myAssignments(req, res, next) {
  try {
    return res.json({ success: true, data: await listMyAssignments(req.query, req) });
  } catch (error) { return next(error); }
}

export async function updateStatus(req, res, next) {
  try {
    return res.json({ success: true, data: await updateAssignedStatus(req.params.complaintId, req.body, req), message: 'Complaint status updated successfully' });
  } catch (error) { return next(error); }
}

export async function respond(req, res, next) {
  try {
    return res.json({ success: true, data: await respondToAssignment(req.params.complaintId, req.body.response, req), message: `Assignment ${req.body.response}` });
  } catch (error) { return next(error); }
}

export async function completionVerification(req, res, next) {
  try { return res.json({ success: true, data: await getCompletionVerification(req.params.complaintId, req), message: 'Completion verification loaded' }); }
  catch (error) { return next(error); }
}

export async function completionVerifications(req, res, next) {
  try { return res.json({ success: true, data: await listCompletionVerifications(), message: 'Completion verification queue loaded' }); }
  catch (error) { return next(error); }
}

export async function reviewCompletion(req, res, next) {
  try {
    const complaint = await reviewCompletionVerification(req.params.complaintId, req.body.decision, req);
    if (req.body.decision === 'approve') {
      await gamificationService.awardPoints(complaint.createdBy, 'complaint_resolved', complaint._id);
    }
    return res.json({ success: true, data: complaint, message: 'Completion verification review saved' });
  }
  catch (error) { return next(error); }
}

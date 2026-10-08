import { getComplaint } from '../services/complaintService.js';
import Complaint from '../models/Complaint.js';
import { AIClassificationError, classifyComplaint } from '../services/aiClassificationService.js';

export async function classify(req, res, next) {
  try {
    const complaint = await getComplaint(req.params.id, req);

    const result = await classifyComplaint(
      complaint,
      req.user.sub
    );

    // getComplaint returns a serialized value for the API, so persist the
    // optional AI suggestion with a model update rather than calling save() on it.
    await Complaint.findByIdAndUpdate(complaint._id, {
      $set: { category: result.category, priority: result.priority },
      $unset: { verificationStatus: 1 }
    });

    return res.json({
      success: true,
      data: result,
      message: 'Complaint classified successfully'
    });
  } catch (error) {
    if (error instanceof AIClassificationError && req.params.id) {
      // Complaint creation already succeeded before this optional request. Mark
      // it for human triage and preserve the existing error response contract.
      await Complaint.findByIdAndUpdate(req.params.id, {
        $set: { verificationStatus: 'manual_review' }
      }).catch((persistError) => {
        console.error('[AI] manual review status could not be saved', {
          complaintId: req.params.id,
          reason: persistError.message
        });
      });
    }
    return next(error);
  }
}

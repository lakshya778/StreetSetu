import { getComplaint } from '../services/complaintService.js';
import { classifyComplaint } from '../services/aiClassificationService.js';

export async function classify(req, res, next) {
  try {
    const complaint = await getComplaint(req.params.id, req);
    const result = await classifyComplaint(complaint, req.user.sub);
    return res.json({
      success: true,
      data: result,
      message: 'Complaint classified successfully'
    });
  } catch (error) {
    return next(error);
  }
}
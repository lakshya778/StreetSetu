import { uploadImagesToCloudinary } from '../services/uploadService.js';
import { addWorkEvidence } from '../services/workEvidenceService.js';

export async function uploadImages(req, res, next) {
  try {
    const uploaded = await uploadImagesToCloudinary(req.files, req.user.sub);
    const attachments = uploaded.map((image, index) => ({
      ...image,
      ...req.complaintEvidenceMetadata[index]
    }));
    return res.status(201).json({
      success: true,
      data: { attachments },
      message: 'Images uploaded successfully'
    });
  } catch (error) {
    return next(error);
  }
}

export async function uploadWorkEvidence(req, res, next) {
  try {
    const stage = req.params.stage;
    const result = await addWorkEvidence({
      complaintId: req.params.complaintId,
      stage,
      files: req.files,
      req
    });
    return res.status(201).json({
      success: true,
      data: result,
      message: `${stage === 'before' ? 'Work-start' : 'Completion'} images uploaded successfully`
    });
  } catch (error) {
    return next(error);
  }
}

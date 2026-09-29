import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadImages } from '../middleware/upload.js';
import { uploadImages as uploadImagesController, uploadWorkEvidence } from '../controllers/uploadController.js';
import { validateImageUpload } from '../validators/uploadValidator.js';

const router = Router();

router.use(authenticate);
router.post('/images', uploadImages, validateImageUpload, uploadImagesController);
router.post('/complaints/:complaintId/before-images', uploadImages, validateImageUpload, (req, res, next) => {
  req.params.stage = 'before';
  return uploadWorkEvidence(req, res, next);
});
router.post('/complaints/:complaintId/after-images', uploadImages, validateImageUpload, (req, res, next) => {
  req.params.stage = 'after';
  return uploadWorkEvidence(req, res, next);
});

export default router;

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadImages } from '../middleware/upload.js';
import { uploadImages as uploadImagesController } from '../controllers/uploadController.js';
import { validateImageUpload } from '../validators/uploadValidator.js';

const router = Router();

router.use(authenticate);
router.post('/images', uploadImages, validateImageUpload, uploadImagesController);

export default router;

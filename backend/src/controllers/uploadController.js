import { uploadImagesToCloudinary } from '../services/uploadService.js';

export async function uploadImages(req, res, next) {
  try {
    const attachments = await uploadImagesToCloudinary(req.files, req.user.sub);
    return res.status(201).json({
      success: true,
      data: { attachments },
      message: 'Images uploaded successfully'
    });
  } catch (error) {
    return next(error);
  }
}

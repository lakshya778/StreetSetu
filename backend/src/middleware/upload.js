import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const allowedMimeExtensions = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])]
]);
export const maxUploadFiles = Math.min(Math.max(Number.parseInt(process.env.UPLOAD_MAX_FILES, 10) || 5, 1), 5);
export const maxUploadFileSize = Math.min(Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_BYTES, 10) || 5 * 1024 * 1024, 5 * 1024 * 1024);

function fileFilter(req, file, callback) {
  const allowedExtensions = allowedMimeExtensions.get(file.mimetype);
  const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!allowedExtensions?.has(extension)) {
    const error = new Error('Only JPG, JPEG, PNG, and WebP images are supported');
    error.statusCode = 400;
    error.code = 'INVALID_FILE_TYPE';
    return callback(error);
  }
  return callback(null, true);
}

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    files: maxUploadFiles,
    fileSize: maxUploadFileSize
  },
  fileFilter
}).array('images', maxUploadFiles);

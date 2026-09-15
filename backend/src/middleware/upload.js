import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const maxUploadFiles = Number.parseInt(process.env.UPLOAD_MAX_FILES, 10) || 10;
export const maxUploadFileSize = Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_BYTES, 10) || 5 * 1024 * 1024;

function fileFilter(req, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error('Only JPEG, PNG, and WebP images are supported');
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

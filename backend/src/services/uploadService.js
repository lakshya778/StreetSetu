import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMATS = {
  'image/jpeg': {
    extensions: new Set(['.jpg', '.jpeg']),
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  'image/png': {
    extensions: new Set(['.png']),
    matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  },
  'image/webp': {
    extensions: new Set(['.webp']),
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  }
};

function serviceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw serviceError('Cloudinary upload service is not configured', 503, 'UPLOAD_SERVICE_UNAVAILABLE');
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
}

function validateImageFile(file) {
  const format = IMAGE_FORMATS[file.mimetype];
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!format?.extensions.has(extension) || !format.matches(file.buffer)) {
    throw serviceError('Image content, file extension, and MIME type must match JPG, JPEG, PNG, or WebP', 400, 'INVALID_FILE_TYPE');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw serviceError('Each image must be 5 MB or smaller', 413, 'UPLOAD_TOO_LARGE');
  }
}

function uploadBuffer(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) return reject(new Error('Cloudinary returned an incomplete upload result'));
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

export async function deleteImagesFromCloudinary(images = []) {
  if (!images.length) return;
  configureCloudinary();
  await Promise.allSettled(images.filter((image) => image.storageKey).map((image) => (
    cloudinary.uploader.destroy(image.storageKey, { resource_type: 'image' })
  )));
}

export async function uploadImagesToCloudinary(files, userId, { purpose = 'complaints', complaintId } = {}) {
  if (!Array.isArray(files) || files.length === 0 || files.length > 5) {
    throw serviceError('Upload between 1 and 5 images per request', 400, 'UPLOAD_VALIDATION_ERROR');
  }
  files.forEach(validateImageFile);
  configureCloudinary();

  const rootFolder = (process.env.CLOUDINARY_UPLOAD_FOLDER || 'streetsetu').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const ownerFolder = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const complaintFolder = complaintId ? `/${String(complaintId).replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  const folder = `${rootFolder}/${purpose}${complaintFolder}/${ownerFolder}`;
  const uploaded = [];

  try {
    for (const file of files) {
      const result = await uploadBuffer(file, folder);
      uploaded.push({
        url: result.secure_url,
        mimeType: file.mimetype,
        fileName: path.basename(file.originalname),
        size: file.size,
        storageKey: result.public_id,
        uploadedAt: new Date()
      });
    }
    return uploaded;
  } catch (error) {
    await deleteImagesFromCloudinary(uploaded);
    throw error;
  }
}

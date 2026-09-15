import { v2 as cloudinary } from 'cloudinary';

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Cloudinary upload service is not configured');
    error.statusCode = 503;
    error.code = 'UPLOAD_SERVICE_UNAVAILABLE';
    throw error;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadBuffer(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

export async function uploadImagesToCloudinary(files, userId) {
  configureCloudinary();
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'streetsetu';
  const userFolder = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const results = await Promise.all(
    files.map(async (file) => {
      const result = await uploadBuffer(file, `${folder}/complaints/${userFolder}`);
      return {
        url: result.secure_url,
        mimeType: file.mimetype,
        fileName: file.originalname,
        size: file.size,
        storageKey: result.public_id
      };
    })
  );
  return results;
}

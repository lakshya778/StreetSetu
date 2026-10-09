import { createHash } from 'node:crypto';

const MAX_PHOTOS = 5;
const MAX_CAPTURE_AGE_MS = 5 * 60 * 1000;
const MAX_PHOTO_DISTANCE_METERS = 200;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function evidenceError(message, code = 'INVALID_CAPTURE_METADATA') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function parseCaptureMetadata(value) {
  try {
    const metadata = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(metadata)) throw new Error('Expected an array');
    return metadata;
  } catch {
    throw evidenceError('Valid capture metadata is required');
  }
}

function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function validCoordinate(value, minimum, maximum) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
}

export function validateComplaintEvidenceUpload({
  files,
  captureMetadata: rawMetadata,
  latitude,
  longitude,
  now = new Date()
}) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_PHOTOS) {
    throw evidenceError('Upload between 1 and 5 complaint photos', 'UPLOAD_VALIDATION_ERROR');
  }
  const metadata = parseCaptureMetadata(rawMetadata);
  if (metadata.length !== files.length) {
    throw evidenceError('Capture metadata must be provided for every photo');
  }
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    throw evidenceError('A valid complaint location is required');
  }

  return metadata.map((item, index) => {
    if (!item || item.captureSource !== 'live_camera') {
      throw evidenceError('Live camera capture required', 'LIVE_CAMERA_REQUIRED');
    }

    const normalized = { captureSource: item.captureSource };
    const photoLatitude = Number(item.latitude);
    const photoLongitude = Number(item.longitude);
    const accuracy = Number(item.accuracy);
    const capturedAt = new Date(item.capturedAt);
    if (!validCoordinate(photoLatitude, -90, 90)
      || !validCoordinate(photoLongitude, -180, 180)
      || !Number.isFinite(accuracy) || accuracy < 0
      || typeof item.capturedAt !== 'string' || !ISO_TIMESTAMP.test(item.capturedAt)
      || Number.isNaN(capturedAt.getTime())) {
      throw evidenceError('Valid live camera location, accuracy, and capture time are required');
    }
    normalized.imageMetadata = {
      latitude: photoLatitude,
      longitude: photoLongitude,
      accuracy,
      capturedAt,
      captureSource: item.captureSource
    };
    if (Math.abs(now.getTime() - capturedAt.getTime()) > MAX_CAPTURE_AGE_MS) {
      normalized.evidenceFlag = 'time_mismatch';
    }
    if (distanceMeters(
      Number(latitude),
      Number(longitude),
      photoLatitude,
      photoLongitude
    ) > MAX_PHOTO_DISTANCE_METERS) {
      normalized.evidenceFlag = 'location_mismatch';
    }

    const file = files[index];
    if (!file?.buffer?.length) throw evidenceError(`Photo ${index + 1} is empty`, 'UPLOAD_VALIDATION_ERROR');
    normalized.proofHash = createHash('sha256').update(file.buffer).digest('hex');
    return normalized;
  });
}

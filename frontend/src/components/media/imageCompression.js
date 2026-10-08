const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const TARGET_BYTES = 600 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The photo could not be compressed. Please choose another image.'));
    }, 'image/jpeg', quality);
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function compressImageFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose a supported image file.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} is too large to prepare on this device.`);

  const image = await decodeImage(file);
  try {
    if (file.type === 'image/jpeg' && file.size <= TARGET_BYTES && Math.max(image.width, image.height) <= MAX_DIMENSION) return file;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The photo could not be prepared on this device.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob;
    for (const quality of JPEG_QUALITIES) {
      blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!blob || blob.size > MAX_OUTPUT_BYTES) {
      throw new Error(`${file.name} could not be compressed below 5 MB. Choose a smaller photo.`);
    }
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'streetsetu-photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    image.close?.();
  }
}

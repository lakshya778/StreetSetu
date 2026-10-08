import { useEffect, useMemo, useRef, useState } from 'react';
import ImageGallery from './ImageGallery.jsx';
import { compressImageFile } from './imageCompression.js';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_SOURCE_SIZE_BYTES = 25 * 1024 * 1024;

export default function ImageUploader({ files, onChange, disabled = false, label = 'Add images', maxFiles = 5 }) {
  const inputRef = useRef(null);
  const processingRef = useRef(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const previews = useMemo(() => files.map((file) => ({
    src: URL.createObjectURL(file),
    fileName: file.name
  })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.src)), [previews]);

  async function addFiles(incomingFiles) {
    if (processingRef.current || disabled) return;
    setError('');
    const accepted = [];
    for (const file of incomingFiles) {
      if (!ACCEPTED_TYPES.has(file.type) || !ACCEPTED_EXTENSIONS.test(file.name)) {
        setError('Choose JPG, JPEG, PNG, or WebP images.');
        continue;
      }
      if (file.size > MAX_SOURCE_SIZE_BYTES) {
        setError(`${file.name} is too large to prepare on this device.`);
        continue;
      }
      accepted.push(file);
    }
    const remaining = Math.max(0, maxFiles - files.length);
    if (accepted.length > remaining) setError(`Choose up to ${maxFiles} images.`);
    const filesToProcess = accepted.slice(0, remaining);
    if (!filesToProcess.length) return;
    processingRef.current = true;
    setIsProcessing(true);
    setProcessingProgress(0);
    const compressed = [];
    try {
      for (const [index, file] of filesToProcess.entries()) {
        compressed.push(await compressImageFile(file));
        setProcessingProgress(Math.round(((index + 1) / filesToProcess.length) * 100));
      }
      const uniqueFiles = [...files];
      compressed.forEach((file) => {
        if (!uniqueFiles.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) uniqueFiles.push(file);
      });
      onChange(uniqueFiles.slice(0, maxFiles));
    } catch (compressionError) {
      setError(compressionError.message || 'A photo could not be prepared. Please try another image.');
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    if (!disabled) void addFiles(Array.from(event.dataTransfer.files || []));
  }

  return <div className="image-uploader">
    <input ref={inputRef} className="image-uploader-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple disabled={disabled || isProcessing} onChange={(event) => { void addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <button className="image-dropzone" type="button" disabled={disabled || isProcessing} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <span className="image-dropzone-icon">＋</span><strong>{isProcessing ? `Preparing photos… ${processingProgress}%` : label}</strong><small>Drag and drop or browse · JPG, PNG, WebP · up to 5 MB after compression · {files.length}/{maxFiles}</small>
    </button>
    {isProcessing && <div className="upload-progress" role="status"><progress max="100" value={processingProgress} /><span>Optimizing photos for upload · {processingProgress}%</span></div>}
    {error && <p className="image-uploader-error" role="alert">{error}</p>}
    <ImageGallery images={previews} label="Selected image previews" onRemove={(index) => onChange(files.filter((_, fileIndex) => fileIndex !== index))} />
  </div>;
}

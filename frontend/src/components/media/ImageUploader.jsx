import { useEffect, useMemo, useRef, useState } from 'react';
import ImageGallery from './ImageGallery.jsx';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function ImageUploader({ files, onChange, disabled = false, label = 'Add images', maxFiles = 5 }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map((file) => ({
    src: URL.createObjectURL(file),
    fileName: file.name
  })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.src)), [previews]);

  function addFiles(incomingFiles) {
    setError('');
    const accepted = [];
    for (const file of incomingFiles) {
      if (!ACCEPTED_TYPES.has(file.type) || !ACCEPTED_EXTENSIONS.test(file.name)) {
        setError('Choose JPG, JPEG, PNG, or WebP images.');
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      accepted.push(file);
    }
    const uniqueFiles = [...files];
    accepted.forEach((file) => {
      if (!uniqueFiles.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) uniqueFiles.push(file);
    });
    if (uniqueFiles.length > maxFiles) setError(`Choose up to ${maxFiles} images.`);
    onChange(uniqueFiles.slice(0, maxFiles));
  }

  function handleDrop(event) {
    event.preventDefault();
    if (!disabled) addFiles(Array.from(event.dataTransfer.files || []));
  }

  return <div className="image-uploader">
    <input ref={inputRef} className="image-uploader-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <button className="image-dropzone" type="button" disabled={disabled} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <span className="image-dropzone-icon">＋</span><strong>{label}</strong><small>Drag and drop or browse · JPG, PNG, WebP · up to 5 MB each · {files.length}/{maxFiles}</small>
    </button>
    {error && <p className="image-uploader-error" role="alert">{error}</p>}
    <ImageGallery images={previews} label="Selected image previews" onRemove={(index) => onChange(files.filter((_, fileIndex) => fileIndex !== index))} />
  </div>;
}

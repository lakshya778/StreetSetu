export default function ImageGallery({ images = [], label = 'Images', compact = false, onRemove }) {
  const availableImages = images.filter((image) => image?.url || image?.src || image?.previewUrl);
  if (!availableImages.length) return null;

  return <div className={`image-gallery ${compact ? 'image-gallery-compact' : ''}`} aria-label={label}>
    {availableImages.map((image, index) => {
      const src = image.url || image.previewUrl || image.src;
      const alt = image.fileName || image.alt || `${label} ${index + 1}`;
      return <figure className="image-gallery-item" key={image.storageKey || `${src}-${index}`}>
        <a href={src} target="_blank" rel="noreferrer" aria-label={`Open ${alt}`}><img src={src} alt={alt} loading="lazy" /></a>
        {image.fileName && !compact && <figcaption>{image.fileName}</figcaption>}
        {onRemove && <button type="button" className="image-gallery-remove" onClick={() => onRemove(index)} aria-label={`Remove ${alt}`}>×</button>}
      </figure>;
    })}
  </div>;
}

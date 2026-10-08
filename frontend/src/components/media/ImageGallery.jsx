import { useEffect, useState } from 'react';

export default function ImageGallery({ images = [], label = 'Images', compact = false, onRemove }) {
  const seenUrls = new Set();
  const availableImages = (Array.isArray(images) ? images : []).reduce((unique, image, sourceIndex) => {
    const url = image?.url || image?.src || image?.previewUrl;
    if (!url || seenUrls.has(url)) return unique;
    seenUrls.add(url);
    unique.push({ image, url, sourceIndex });
    return unique;
  }, []);
  const [activeIndex, setActiveIndex] = useState(null);
  const [zoom, setZoom] = useState(1);
  const isOpen = activeIndex !== null;
  const activeImage = isOpen ? availableImages[activeIndex]?.image : null;
  const activeSrc = activeImage?.url || activeImage?.previewUrl || activeImage?.src;
  const activeAlt = activeImage?.fileName || activeImage?.alt || `${label} ${activeIndex + 1}`;

  function closeViewer() { setActiveIndex(null); setZoom(1); }
  function showImage(index) {
    setActiveIndex((index + availableImages.length) % availableImages.length);
    setZoom(1);
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event) {
      if (event.key === 'Escape') closeViewer();
      if (event.key === 'ArrowRight' && availableImages.length > 1) showImage(activeIndex + 1);
      if (event.key === 'ArrowLeft' && availableImages.length > 1) showImage(activeIndex - 1);
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(value + 0.25, 3));
      if (event.key === '-') setZoom((value) => Math.max(value - 0.25, 1));
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, availableImages.length, isOpen]);

  if (!availableImages.length) return null;

  return <>
    <div className={`image-gallery ${compact ? 'image-gallery-compact' : ''}`} aria-label={label}>
      {availableImages.map(({ image, url, sourceIndex }, index) => {
        const src = url;
        const alt = image.fileName || image.alt || `${label} ${index + 1}`;
        return <figure className="image-gallery-item" key={src}>
          <button type="button" className="image-gallery-trigger" onClick={() => showImage(index)} aria-label={`View ${alt}`}>
            <img src={src} alt={alt} loading="lazy" decoding="async" width="400" height="300" />
          </button>
          {image.fileName && !compact && <figcaption>{image.fileName}</figcaption>}
          {onRemove && <button type="button" className="image-gallery-remove" onClick={() => onRemove(sourceIndex)} aria-label={`Remove ${alt}`}>×</button>}
        </figure>;
      })}
    </div>
    {isOpen && <div className="image-viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeViewer(); }}>
      <section className="image-viewer-modal" role="dialog" aria-modal="true" aria-label={`${label} viewer`}>
        <header className="image-viewer-toolbar">
          <span>{activeAlt}<small>{activeIndex + 1} / {availableImages.length}</small></span>
          <div className="image-viewer-controls">
            <button type="button" onClick={() => setZoom((value) => Math.min(value + 0.25, 3))} aria-label="Zoom in" disabled={zoom >= 3}>+</button>
            <button type="button" onClick={() => setZoom((value) => Math.max(value - 0.25, 1))} aria-label="Zoom out" disabled={zoom <= 1}>−</button>
            <button type="button" onClick={closeViewer} aria-label="Close image viewer">×</button>
          </div>
        </header>
        <div className="image-viewer-stage">
          {availableImages.length > 1 && <button type="button" className="image-viewer-nav image-viewer-prev" onClick={() => showImage(activeIndex - 1)} aria-label="Previous image">‹</button>}
          <img src={activeSrc} alt={activeAlt} loading="lazy" decoding="async" width="1600" height="1200" style={{ transform: `scale(${zoom})` }} />
          {availableImages.length > 1 && <button type="button" className="image-viewer-nav image-viewer-next" onClick={() => showImage(activeIndex + 1)} aria-label="Next image">›</button>}
        </div>
        <footer className="image-viewer-caption">Zoom {Math.round(zoom * 100)}% · Use arrow keys to browse, Esc to close</footer>
      </section>
    </div>}
  </>;
}

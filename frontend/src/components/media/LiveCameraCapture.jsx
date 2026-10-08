import { useEffect, useRef, useState } from 'react';

function geolocationPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000
    });
  });
}

function canvasJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The captured photo could not be encoded. Please retake it.'));
    }, 'image/jpeg', 0.92);
  });
}

function cameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No camera was found. Connect a webcam or check that a camera is available.';
  }
  return 'The camera could not be started. Check browser permissions and try again.';
}

export default function LiveCameraCapture({ disabled = false, onSubmit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera access. Use a supported browser over HTTPS or localhost.');
        return;
      }
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
          });
        } catch (cameraError) {
          if (cameraError?.name === 'NotAllowedError' || cameraError?.name === 'SecurityError') throw cameraError;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (active) setCameraReady(true);
      } catch (cameraError) {
        if (active) setError(cameraErrorMessage(cameraError));
      }
    }

    void startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function capturePhoto() {
    setError('');
    setIsCapturing(true);
    const capturedAt = new Date();
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        throw new Error('The camera is not ready yet. Wait for the preview and try again.');
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The camera image could not be prepared. Please try again.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      let position;
      try {
        position = await geolocationPosition();
      } catch {
        throw new Error('Location permission is required for completion proof. Allow location access and try again.');
      }
      const { latitude, longitude, accuracy } = position.coords;
      if (![latitude, longitude, accuracy].every(Number.isFinite)) {
        throw new Error('A reliable location could not be read. Enable device location and try again.');
      }

      const watermarkHeight = Math.max(76, Math.round(canvas.width * 0.12));
      const fontSize = Math.max(15, Math.round(canvas.width * 0.025));
      context.fillStyle = 'rgba(0, 0, 0, 0.68)';
      context.fillRect(0, canvas.height - watermarkHeight, canvas.width, watermarkHeight);
      context.fillStyle = '#ffffff';
      context.font = `600 ${fontSize}px sans-serif`;
      context.textBaseline = 'top';
      context.fillText(`StreetSetu · ${capturedAt.toLocaleString()}`, 14, canvas.height - watermarkHeight + 10);
      context.fillText(`Lat ${latitude.toFixed(6)}, Lon ${longitude.toFixed(6)} · ±${Math.round(accuracy)} m`, 14, canvas.height - watermarkHeight + 10 + fontSize + 5);

      const blob = await canvasJpeg(canvas);
      const file = new File([blob], `streetsetu-proof-${capturedAt.getTime()}.jpg`, { type: 'image/jpeg' });
      const nextPreviewUrl = URL.createObjectURL(blob);
      setPreviewUrl(nextPreviewUrl);
      setPhoto({
        file,
        metadata: {
          latitude,
          longitude,
          accuracy,
          capturedAt: capturedAt.toISOString(),
          captureSource: 'live_camera'
        }
      });
    } catch (captureError) {
      setError(captureError.message || 'The proof photo could not be captured. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  function retakePhoto() {
    setPhoto(null);
    setPreviewUrl('');
    setError('');
  }

  return <div className="live-camera-capture">
    <video ref={videoRef} className="live-camera-video" autoPlay muted playsInline hidden={Boolean(photo)} aria-label="Live camera preview" />
    {photo && <img className="live-camera-preview" src={previewUrl} alt="Captured completion proof with StreetSetu location and time watermark" />}
    <canvas ref={canvasRef} hidden />
    {error && <p className="capture-error" role="alert">{error}</p>}
    <div className="capture-actions">
      {!photo && <button type="button" className="assignment-action" disabled={disabled || !cameraReady || isCapturing} onClick={() => void capturePhoto()}>
        {isCapturing ? 'Capturing…' : cameraReady ? 'Capture proof photo' : 'Starting camera…'}
      </button>}
      {photo && <>
        <button type="button" className="outline-button" disabled={disabled} onClick={retakePhoto}>Retake photo</button>
        <button type="button" className="assignment-action evidence-submit-button" disabled={disabled} onClick={() => onSubmit(photo.file, photo.metadata)}>
          {disabled ? 'Saving…' : 'Submit completion photo'}
        </button>
      </>}
    </div>
  </div>;
}

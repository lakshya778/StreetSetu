import { useCallback, useEffect, useRef, useState } from 'react';
import usePermissionStatus from '../../hooks/usePermissionStatus.js';
import PermissionGuideModal from './PermissionGuideModal.jsx';

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
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    const encode = (index) => canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The captured photo could not be encoded. Please retake it.'));
      } else if (blob.size <= 600 * 1024 || index === qualities.length - 1) {
        resolve(blob);
      } else {
        encode(index + 1);
      }
    }, 'image/jpeg', qualities[index]);
    encode(0);
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
  const permissionRequestRef = useRef(false);
  const { cameraState, locationState, hasChecked, refresh } = usePermissionStatus();
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [guideForced, setGuideForced] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  useEffect(() => {
    let active = true;

    function stopCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
    }

    async function startCamera() {
      if (streamRef.current?.active || !videoRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser does not support camera access. Use a supported browser over HTTPS or localhost.');
        return;
      }
      try {
        const stream = await requestCameraStream();
        if (!active || document.visibilityState === 'hidden') {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        await attachCameraStream(stream);
      } catch (cameraError) {
        if (active) handleCameraError(cameraError);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      } else if (hasChecked && (cameraState === 'unknown' || (cameraState === 'granted' && locationState === 'granted')) && !photo) {
        void startCamera();
      }
    }

    if (hasChecked && (cameraState === 'unknown' || (cameraState === 'granted' && locationState === 'granted'))) {
      void startCamera();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [cameraRetry, cameraState, hasChecked, locationState, photo]);

  useEffect(() => {
    if (cameraState === 'granted' && locationState === 'granted') {
      setCameraPermissionDenied(false);
      setLocationPermissionDenied(false);
      setGuideForced(false);
      setGuideDismissed(true);
    }
  }, [cameraState, locationState]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The camera image could not be prepared. Please try again.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      let position;
      try {
        position = await geolocationPosition();
        setLocationPermissionDenied(false);
      } catch (locationError) {
        if (locationError?.code === 1) {
          setLocationPermissionDenied(true);
          setGuideForced(true);
          setGuideDismissed(false);
          void refresh();
          throw new Error('Location permission is blocked. Allow Location in browser or device settings, then retry.');
        }
        if (locationError?.code === 2 || locationError?.code === 3) {
          throw new Error('Phone/laptop ki Location ON karo');
        }
        throw new Error('Phone/laptop ki Location ON karo');
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
      video.pause();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
    } catch (captureError) {
      setError(captureError.message || 'The proof photo could not be captured. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  async function requestCameraStream() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (cameraRequestError) {
      if (cameraRequestError?.name === 'NotAllowedError' || cameraRequestError?.name === 'SecurityError') {
        throw cameraRequestError;
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    }
    return stream;
  }

  async function attachCameraStream(stream) {
    if (!videoRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    try {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraError(null);
      setCameraPermissionDenied(false);
      setCameraReady(true);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      throw error;
    }
  }

  function handleCameraError(cameraRequestError) {
    setCameraReady(false);
    setCameraError(cameraErrorMessage(cameraRequestError));
    if (cameraRequestError?.name === 'NotAllowedError' || cameraRequestError?.name === 'SecurityError') {
      setCameraPermissionDenied(true);
      setGuideDismissed(false);
      setGuideForced(true);
    }
  }

  const onAllow = useCallback(async () => {
    if (permissionRequestRef.current) return;
    permissionRequestRef.current = true;
    setGuideDismissed(false);
    setCameraError(null);
    setError('');
    const cameraRequest = streamRef.current?.active
      ? Promise.resolve(streamRef.current)
      : Promise.resolve().then(requestCameraStream);
    const locationRequest = geolocationPosition();
    const [cameraResult, locationResult] = await Promise.allSettled([cameraRequest, locationRequest]);

    try {
      if (cameraResult.status === 'fulfilled') {
        await attachCameraStream(cameraResult.value);
      } else {
        handleCameraError(cameraResult.reason);
      }
      if (locationResult.status === 'rejected') {
        if (locationResult.reason?.code === 1) {
          setLocationPermissionDenied(true);
          setError('Location permission is blocked. Allow Location in browser or device settings, then retry.');
          setGuideForced(true);
          setGuideDismissed(false);
        } else {
          setLocationPermissionDenied(false);
          setError('Phone/laptop ki Location ON karo');
        }
      } else {
        setLocationPermissionDenied(false);
      }
      const permissions = await refresh();
      if ((permissions.cameraState === 'granted' && permissions.locationState === 'granted')
        || (cameraResult.status === 'fulfilled' && locationResult.status === 'fulfilled')) {
        setGuideForced(false);
        setGuideDismissed(true);
      }
    } finally {
      permissionRequestRef.current = false;
    }
  }, [refresh]);

  const onRetry = useCallback(async () => {
    setGuideDismissed(false);
    setGuideForced(false);
    const permissions = await refresh();
    const needsRequest = permissions.cameraState === 'prompt'
      || permissions.locationState === 'prompt'
      || permissions.cameraState === 'unknown'
      || permissions.locationState === 'unknown';
    if (needsRequest) await onAllow();
    else if (permissions.cameraState === 'granted' && permissions.locationState === 'granted') {
      setCameraRetry((attempt) => attempt + 1);
    }
  }, [onAllow, refresh]);

  const closeGuide = useCallback(() => {
    setGuideDismissed(true);
    setGuideForced(false);
  }, []);

  function retakePhoto() {
    setPhoto(null);
    setPreviewUrl('');
    setError('');
    setCameraRetry((attempt) => attempt + 1);
  }

  return <div className="live-camera-capture">
    {(!guideDismissed && (guideForced || cameraState === 'prompt' || locationState === 'prompt' || cameraState === 'denied' || locationState === 'denied')) && <PermissionGuideModal
      cameraState={cameraPermissionDenied ? 'denied' : cameraState}
      locationState={locationPermissionDenied ? 'denied' : locationState}
      onAllow={() => void onAllow()}
      onRetry={() => void onRetry()}
      onClose={closeGuide}
    />}
    <video ref={videoRef} className="live-camera-video" autoPlay muted playsInline hidden={Boolean(photo)} aria-label="Live camera preview" />
    {photo && <img className="live-camera-preview" src={previewUrl} alt="Captured completion proof with StreetSetu location and time watermark" loading="lazy" decoding="async" width="1280" height="720" />}
    <canvas ref={canvasRef} hidden />
    {(error || cameraError) && <p className="capture-error" role="alert">{error || cameraError}</p>}
    {(cameraState !== 'granted' || locationState !== 'granted') && guideDismissed && <button type="button" className="outline-button" onClick={() => setGuideDismissed(false)}>Permission help</button>}
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

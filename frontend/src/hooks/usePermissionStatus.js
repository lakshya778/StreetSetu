import { useCallback, useEffect, useRef, useState } from 'react';

const PERMISSION_NAMES = ['camera', 'geolocation'];

function permissionState(status) {
  return ['granted', 'prompt', 'denied'].includes(status) ? status : 'unknown';
}

export default function usePermissionStatus() {
  const [cameraState, setCameraState] = useState('unknown');
  const [locationState, setLocationState] = useState('unknown');
  const [hasChecked, setHasChecked] = useState(false);
  const permissionStatusesRef = useRef([]);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const permissions = navigator.permissions;
    if (!permissions?.query) {
      if (mountedRef.current) {
        setCameraState('unknown');
        setLocationState('unknown');
        setHasChecked(true);
      }
      return { cameraState: 'unknown', locationState: 'unknown' };
    }

    const results = await Promise.all(PERMISSION_NAMES.map(async (name) => {
      try {
        return await permissions.query({ name });
      } catch {
        return null;
      }
    }));

    const [cameraPermission, locationPermission] = results;
    const nextCameraState = permissionState(cameraPermission?.state);
    const nextLocationState = permissionState(locationPermission?.state);
    if (!mountedRef.current) return { cameraState: nextCameraState, locationState: nextLocationState };

    permissionStatusesRef.current.forEach((status) => { status.onchange = null; });
    permissionStatusesRef.current = results.filter(Boolean);

    setCameraState(nextCameraState);
    setLocationState(nextLocationState);
    setHasChecked(true);

    if (cameraPermission) {
      cameraPermission.onchange = () => {
        if (mountedRef.current) setCameraState(permissionState(cameraPermission.state));
      };
    }
    if (locationPermission) {
      locationPermission.onchange = () => {
        if (mountedRef.current) setLocationState(permissionState(locationPermission.state));
      };
    }
    return { cameraState: nextCameraState, locationState: nextLocationState };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      permissionStatusesRef.current.forEach((status) => { status.onchange = null; });
      permissionStatusesRef.current = [];
    };
  }, [refresh]);

  return { cameraState, locationState, hasChecked, refresh };
}

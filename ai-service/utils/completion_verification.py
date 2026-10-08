"""Lightweight metadata checks for completion evidence.

Visual similarity inference is intentionally disabled to keep the service within
small-instance memory limits. Completion evidence is sent to admin review.
"""

import math
from datetime import datetime, timedelta, timezone


MAX_IMAGE_AGE = timedelta(days=30)
MAX_IMAGES_PER_STAGE = 5
MAX_GPS_DISTANCE_METERS = 200


def extract_metadata(_image_bytes):
    """Return empty EXIF fields when optional image parsers are not installed."""
    return {"latitude": None, "longitude": None, "capturedAt": None}


def _as_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _haversine_meters(lat1, lon1, lat2, lon2):
    radians = math.radians
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    value = math.sin(d_lat / 2) ** 2 + math.cos(radians(lat1)) * math.cos(radians(lat2)) * math.sin(d_lon / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _metadata_checks(before_images, after_images, complaint_latitude, complaint_longitude, now):
    all_images = before_images + after_images
    gps_distances = []
    capture_times = []

    for evidence in all_images:
        metadata = evidence.get("imageMetadata") or {}
        photo_latitude = metadata.get("latitude")
        photo_longitude = metadata.get("longitude")
        if photo_latitude is None or photo_longitude is None:
            gps_distances.append(None)
        else:
            try:
                gps_distances.append(_haversine_meters(
                    float(complaint_latitude),
                    float(complaint_longitude),
                    float(photo_latitude),
                    float(photo_longitude),
                ))
            except (TypeError, ValueError):
                gps_distances.append(None)
        capture_times.append(_as_datetime(metadata.get("capturedAt")))

    available_distances = [distance for distance in gps_distances if distance is not None]
    gps_matched = (
        all(distance <= MAX_GPS_DISTANCE_METERS for distance in available_distances)
        if available_distances else None
    )
    gps_distance = round(max(available_distances), 1) if available_distances else None
    available_capture_times = [value for value in capture_times if value is not None]
    timestamp_valid = None
    if available_capture_times:
        timestamp_valid = all(
            now - MAX_IMAGE_AGE <= value <= now + timedelta(minutes=5)
            for value in available_capture_times
        )
        before_times = [value for value in capture_times[:len(before_images)] if value is not None]
        after_times = [value for value in capture_times[len(before_images):] if value is not None]
        if before_times and after_times:
            timestamp_valid = timestamp_valid and max(before_times) <= min(after_times)

    return gps_matched, gps_distance, timestamp_valid


def verify_completion(payload):
    before_images = payload.get("beforeImages") or []
    after_images = payload.get("afterImages") or []
    location = payload.get("location") or {}
    latitude = location.get("latitude")
    longitude = location.get("longitude")

    if not before_images or not after_images or latitude is None or longitude is None:
        raise ValueError("Before and after photos and complaint coordinates are required")
    if len(before_images) > MAX_IMAGES_PER_STAGE or len(after_images) > MAX_IMAGES_PER_STAGE:
        raise ValueError("At most five before photos and five after photos can be verified")

    gps_matched, gps_distance, timestamp_valid = _metadata_checks(
        before_images,
        after_images,
        latitude,
        longitude,
        datetime.now(timezone.utc),
    )
    return {
        "similarityScore": None,
        "gpsMatched": gps_matched,
        "gpsDistanceMeters": gps_distance,
        "timestampValid": timestamp_valid,
        "fraudScore": None,
        "verificationStatus": "needs_review",
        "failureReason": "Visual comparison is disabled on the lightweight service; manual review required.",
    }

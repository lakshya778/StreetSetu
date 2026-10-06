"""Image metadata extraction and CLIP based completion-evidence checks."""

import io
import math
import os
import threading
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlparse

import requests
import torch
from PIL import ExifTags, Image
from transformers import CLIPModel, CLIPProcessor


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_AGE = timedelta(days=30)
IMAGE_TIMEOUT_SECONDS = 12
CLIP_LOCK = threading.Lock()
GPS_IFD_TAG = 34853
GPS_TAGS = ExifTags.GPSTAGS
EXIF_TAGS = ExifTags.TAGS


@lru_cache(maxsize=1)
def _clip():
    model_name = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained(model_name)
    model = CLIPModel.from_pretrained(model_name)
    model.eval()
    return processor, model


def _rational(value):
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        try:
            return float(value.numerator) / float(value.denominator)
        except (AttributeError, TypeError, ValueError, ZeroDivisionError):
            return None


def _coordinate(value):
    if not isinstance(value, (tuple, list)) or len(value) != 3:
        return None
    degrees, minutes, seconds = (_rational(part) for part in value)
    if degrees is None or minutes is None or seconds is None:
        return None
    return degrees + minutes / 60 + seconds / 3600


def _parse_capture_time(raw_value):
    if not raw_value:
        return None
    if isinstance(raw_value, bytes):
        raw_value = raw_value.decode("ascii", errors="ignore")
    try:
        # EXIF timestamps without an offset are interpreted as UTC for consistent comparisons.
        return datetime.strptime(str(raw_value).strip(), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def extract_metadata(image_bytes):
    image = Image.open(io.BytesIO(image_bytes))
    exif = image.getexif()
    raw = {EXIF_TAGS.get(tag, tag): value for tag, value in exif.items()}
    gps = {}
    try:
        gps_ifd = exif.get_ifd(GPS_IFD_TAG)
        gps = {GPS_TAGS.get(tag, tag): value for tag, value in gps_ifd.items()}
    except (AttributeError, KeyError, TypeError):
        old_gps = exif.get(GPS_IFD_TAG, {})
        if isinstance(old_gps, dict):
            gps = {GPS_TAGS.get(tag, tag): value for tag, value in old_gps.items()}

    latitude = _coordinate(gps.get("GPSLatitude"))
    longitude = _coordinate(gps.get("GPSLongitude"))
    if latitude is not None and str(gps.get("GPSLatitudeRef", "N")).upper() == "S":
        latitude *= -1
    if longitude is not None and str(gps.get("GPSLongitudeRef", "E")).upper() == "W":
        longitude *= -1
    if latitude is not None and not -90 <= latitude <= 90:
        latitude = None
    if longitude is not None and not -180 <= longitude <= 180:
        longitude = None

    captured_at = _parse_capture_time(raw.get("DateTimeOriginal") or raw.get("DateTimeDigitized"))
    return {
        "latitude": latitude,
        "longitude": longitude,
        "capturedAt": captured_at.isoformat().replace("+00:00", "Z") if captured_at else None,
    }


def _allowed_image_host(hostname):
    allowed = os.getenv("COMPLETION_IMAGE_HOSTS", "res.cloudinary.com").split(",")
    hostname = (hostname or "").lower().rstrip(".")
    return any(hostname == host.strip().lower() for host in allowed if host.strip())


def _download_image(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not _allowed_image_host(parsed.hostname):
        raise ValueError("Evidence image URL is not hosted on an approved HTTPS image host")
    response = requests.get(url, timeout=IMAGE_TIMEOUT_SECONDS, stream=True, allow_redirects=False)
    response.raise_for_status()
    chunks = []
    size = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        size += len(chunk)
        if size > MAX_IMAGE_BYTES:
            raise ValueError("Evidence image is too large to verify")
        chunks.append(chunk)
    image_bytes = b"".join(chunks)
    with Image.open(io.BytesIO(image_bytes)) as image:
        image.verify()
    return image_bytes


def _haversine_meters(lat1, lon1, lat2, lon2):
    radians = math.radians
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    value = math.sin(d_lat / 2) ** 2 + math.cos(radians(lat1)) * math.cos(radians(lat2)) * math.sin(d_lon / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _embedding_similarity(before_bytes, after_bytes):
    with CLIP_LOCK:
        processor, model = _clip()
        images = [Image.open(io.BytesIO(value)).convert("RGB") for value in before_bytes + after_bytes]
        inputs = processor(images=images, return_tensors="pt")
        with torch.inference_mode():
            features = model.get_image_features(pixel_values=inputs["pixel_values"])
            features = torch.nn.functional.normalize(features, dim=-1)
        before_count = len(before_bytes)
        similarities = features[:before_count] @ features[before_count:].T
        # Every after photo must resemble at least one before photo; one genuine photo
        # must not hide unrelated images mixed into the upload.
        per_after_best_match = similarities.max(dim=0).values
        return max(0.0, min(1.0, per_after_best_match.min().item()))


def _as_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _timestamp_valid(before_images, after_images, now):
    before_times = [_as_datetime((item.get("imageMetadata") or {}).get("capturedAt")) for item in before_images]
    after_times = [_as_datetime((item.get("imageMetadata") or {}).get("capturedAt")) for item in after_images]
    if not before_times or not after_times or any(value is None for value in before_times + after_times):
        return False
    for evidence in before_images + after_images:
        captured_at = _as_datetime((evidence.get("imageMetadata") or {}).get("capturedAt"))
        uploaded_at = _as_datetime(evidence.get("uploadedAt"))
        if captured_at is None or captured_at > now + timedelta(minutes=5) or captured_at < now - MAX_IMAGE_AGE:
            return False
        if uploaded_at and (captured_at > uploaded_at + timedelta(minutes=5) or captured_at < uploaded_at - MAX_IMAGE_AGE):
            return False
    return max(before_times) <= min(after_times)


def verify_completion(payload):
    before_images = payload.get("beforeImages") or []
    after_images = payload.get("afterImages") or []
    location = payload.get("location") or {}
    latitude, longitude = location.get("latitude"), location.get("longitude")
    if not before_images or not after_images or latitude is None or longitude is None:
        raise ValueError("Before and after photos and complaint coordinates are required")
    if len(before_images) > 5 or len(after_images) > 5:
        raise ValueError("At most five before photos and five after photos can be verified")

    downloaded_before = [_download_image(item["url"]) for item in before_images]
    downloaded_after = [_download_image(item["url"]) for item in after_images]
    similarity = _embedding_similarity(downloaded_before, downloaded_after) if downloaded_before and downloaded_after else 0.0

    gps_distances = []
    for evidence in before_images + after_images:
        metadata = evidence.get("imageMetadata") or {}
        image_lat, image_lon = metadata.get("latitude"), metadata.get("longitude")
        if image_lat is None or image_lon is None:
            gps_distances.append(None)
        else:
            gps_distances.append(_haversine_meters(float(latitude), float(longitude), float(image_lat), float(image_lon)))
    gps_matched = bool(gps_distances) and all(distance is not None and distance < 200 for distance in gps_distances)
    available_distances = [distance for distance in gps_distances if distance is not None]
    max_distance = max(available_distances) if available_distances else None
    timestamp_valid = _timestamp_valid(before_images, after_images, datetime.now(timezone.utc))
    similarity_threshold = float(os.getenv("COMPLETION_SIMILARITY_THRESHOLD", "0.45"))
    fraud_score = round((1 - similarity) * 40 + (0 if gps_matched else 40) + (0 if timestamp_valid else 20), 1)
    verified = gps_matched and timestamp_valid and similarity >= similarity_threshold
    reasons = []
    if not gps_matched:
        reasons.append("Photo GPS is missing or more than 200 metres from the complaint location")
    if not timestamp_valid:
        reasons.append("Photo timestamps are missing, out of order, or outside the allowed capture window")
    if similarity < similarity_threshold:
        reasons.append("Before and after photos do not show a sufficiently similar scene")

    return {
        "similarityScore": round(similarity * 100, 1),
        "gpsMatched": gps_matched,
        "gpsDistanceMeters": round(max_distance, 1) if max_distance is not None else None,
        "timestampValid": timestamp_valid,
        "fraudScore": fraud_score,
        "verificationStatus": "verified" if verified else "needs_review",
        "failureReason": "; ".join(reasons) if reasons else None,
    }

import unittest
from datetime import datetime, timezone

from utils.completion_verification import _metadata_checks


class CompletionMetadataChecksTests(unittest.TestCase):
    def test_missing_exif_metadata_does_not_flag_gps_or_capture_time(self):
        now = datetime.now(timezone.utc)
        result = _metadata_checks(
            [{"imageMetadata": {}}],
            [{"imageMetadata": {"latitude": None, "longitude": None, "capturedAt": None}}],
            28.6139,
            77.2090,
            now,
        )

        self.assertEqual(result, (None, None, None))

    def test_available_device_metadata_is_used_when_work_start_exif_is_missing(self):
        captured_at = datetime.now(timezone.utc)
        result = _metadata_checks(
            [{"imageMetadata": {}}],
            [{
                "imageMetadata": {
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "capturedAt": captured_at.isoformat(),
                }
            }],
            28.6139,
            77.2090,
            captured_at,
        )

        self.assertEqual(result, (True, 0.0, True))

    def test_available_gps_mismatch_is_still_reported(self):
        now = datetime.now(timezone.utc)
        result = _metadata_checks(
            [],
            [{
                "imageMetadata": {
                    "latitude": 28.6239,
                    "longitude": 77.2090,
                    "capturedAt": now.isoformat(),
                }
            }],
            28.6139,
            77.2090,
            now,
        )

        self.assertFalse(result[0])
        self.assertGreater(result[1], 200)


if __name__ == "__main__":
    unittest.main()

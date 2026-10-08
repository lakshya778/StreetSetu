"""Flask HTTP API for StreetSetu complaint classification."""

import hmac
import os
import re
from functools import lru_cache

from flask import Flask, jsonify, request

from utils.classifier import ComplaintClassifier
from utils.completion_verification import extract_metadata, verify_completion


# Backend compatible categories
BACKEND_CATEGORIES = {
    "roads",
    "street_lighting",
    "water_supply",
    "waste_management",
    "drainage",
    "public_safety",
    "parks",
    "sanitation",
    "other"
}

BACKEND_PRIORITIES = {
    "low",
    "medium",
    "high",
    "critical"
}

# Model → Backend mapping
CATEGORY_MAP = {
    "Roads": "roads",
    "Streetlights": "street_lighting",
    "Water": "water_supply",
    "Waste": "waste_management",
    "Drainage": "drainage",
    "Traffic": "public_safety",
    "Other": "other"
}

PRIORITY_MAP = {
    "Low": "low",
    "Medium": "medium",
    "High": "high"
}

TOXIC_TERMS = {
    "kill",
    "hate",
    "stupid",
    "idiot",
    "abuse",
    "threat",
    "violence"
}

SPAM_PATTERNS = (
    r"(.)\1{7,}",
    r"(?:https?://\S+\s*){3,}",
    r"\b(?:buy|win|free money|click here)\b"
)


@lru_cache(maxsize=1)
def get_classifier() -> ComplaintClassifier:
    classifier = ComplaintClassifier()
    app.logger.info("Model loaded successfully")
    return classifier


def _text_fields(payload: dict):
    title = payload.get("title")
    description = payload.get("description")

    if not isinstance(title, str) or not title.strip():
        raise ValueError("title must be a non-empty string")

    if not isinstance(description, str) or not description.strip():
        raise ValueError("description must be a non-empty string")

    return title.strip(), description.strip()


def _is_toxic(text: str) -> bool:
    words = set(re.findall(r"[a-z]+", text.lower()))
    return bool(words & TOXIC_TERMS)


def _is_spam(text: str) -> bool:
    return any(
        re.search(pattern, text, re.IGNORECASE)
        for pattern in SPAM_PATTERNS
    )


def _reasons(category, priority, is_toxic, is_spam):
    reasons = []

    reasons.append(f"Classified as {category}")

    if priority == "high":
        reasons.append(
            "Urgent safety or service disruption language detected"
        )

    elif priority == "medium":
        reasons.append(
            "Moderate service impact detected"
        )

    if is_toxic:
        reasons.append(
            "Potentially abusive language flagged for review"
        )

    if is_spam:
        reasons.append(
            "Repeated promotional or suspicious content detected"
        )

    return reasons


def _authorized():
    configured = os.getenv("AI_SERVICE_TOKEN")

    if not configured:
        return True

    supplied = request.headers.get("Authorization", "")

    return hmac.compare_digest(
        supplied,
        f"Bearer {configured}"
    )


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024


print("AI service started", flush=True)


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "streetsetu-ai"
    })


@app.post("/v1/classify")
def classify():
    app.logger.info("Classify request received")

    if not _authorized():
        app.logger.error("AI service token mismatch")
        return jsonify({
            "error": "Unauthorized"
        }), 401

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        app.logger.warning("Classification request body is not a JSON object")
        return jsonify({
            "error": "Request body must be a JSON object"
        }), 400

    app.logger.info("Classification payload keys: %s", sorted(payload.keys()))

    try:
        title, description = _text_fields(payload)

        result = get_classifier().classify(
            title,
            description
        )

        # Convert model labels to backend labels
        result["category"] = CATEGORY_MAP.get(
            result.get("category"),
            "other"
        )

        result["priority"] = PRIORITY_MAP.get(
            result.get("priority"),
            "medium"
        )

        # Validate
        if result["category"] not in BACKEND_CATEGORIES:
            raise RuntimeError(
                "Model returned an unsupported category"
            )

        if result["priority"] not in BACKEND_PRIORITIES:
            raise RuntimeError(
                "Model returned an unsupported priority"
            )

        text = f"{title} {description}"

        is_toxic = _is_toxic(text)
        is_spam = _is_spam(text)

        response = {
            "category": result["category"],
            "priority": result["priority"],
            "confidence": float(
                result.get("confidence", 0.85)
            ),
            "isToxic": is_toxic,
            "isSpam": is_spam,
            "reasons": _reasons(
                result["category"],
                result["priority"],
                is_toxic,
                is_spam
            )
        }

        app.logger.info("Classification prediction: %s", response)

        return jsonify(response)

    except ValueError as error:
        app.logger.exception("Invalid classification request")
        return jsonify({
            "error": str(error)
        }), 400

    except (FileNotFoundError, RuntimeError) as error:
        app.logger.exception(
            "Classification service failed"
        )

        return jsonify({
            "error": str(error)
        }), 503

    except Exception as error:
        app.logger.exception("Unexpected classification error")

        return jsonify({
            "error": f"Classifier unavailable: {error}"
        }), 503


@app.post("/v1/image-metadata")
def image_metadata():
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 401
    image = request.files.get("image")
    if not image:
        return jsonify({"error": "An image file is required"}), 400
    image_bytes = image.read(10 * 1024 * 1024 + 1)
    if len(image_bytes) > 10 * 1024 * 1024:
        return jsonify({"error": "Image must be 10 MB or smaller"}), 413
    try:
        return jsonify({"success": True, "data": extract_metadata(image_bytes)})
    except Exception as error:
        app.logger.info("Image EXIF metadata could not be extracted: %s", error)
        return jsonify({"success": True, "data": {"latitude": None, "longitude": None, "capturedAt": None}})


@app.post("/v1/verify-completion")
def completion_verification():
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400
    try:
        result = verify_completion(payload)
        return jsonify({"success": True, "data": result})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        app.logger.exception("Completion evidence verification failed")
        return jsonify({"error": f"Completion verification unavailable: {error}"}), 503


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )

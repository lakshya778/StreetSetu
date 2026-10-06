# StreetSetu AI Classification Service

Flask microservice that classifies civic complaints using a TF-IDF text vectorizer and two Logistic Regression outputs: complaint category and priority.

The same service also extracts evidence-image EXIF metadata and asynchronously services backend completion checks using OpenAI CLIP image embeddings. Configure the API process with `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `AI_METADATA_TIMEOUT_MS`, and `AI_VERIFICATION_TIMEOUT_MS`. The first verification downloads the configured CLIP model (`CLIP_MODEL_NAME`, default `openai/clip-vit-base-patch32`) from Hugging Face; provision model cache/storage and enough CPU/GPU memory for production workers.

## Setup

Python 3.10 or newer is recommended. From the repository root:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

The service supports these categories: `Roads`, `Streetlights`, `Water`, `Waste`, `Drainage`, `Traffic`, and `Other`. Priorities are `Low`, `Medium`, and `High`.

## Training

The starter dataset is in `dataset.csv` with `title`, `description`, `category`, and `priority` columns. Retrain after changing the dataset:

```powershell
python train_model.py
```

This writes `model.pkl` and `vectorizer.pkl` in the service directory. The generated artifacts must be rebuilt whenever the dataset or feature configuration changes.

## Running

```powershell
python app.py
```

The development server listens on `http://127.0.0.1:8000`. For a production WSGI process on Linux:

```bash
gunicorn --bind 127.0.0.1:8000 app:app
```

Set `AI_SERVICE_TOKEN` in the service environment to require the same `Authorization: Bearer <token>` header sent by the backend. When it is unset, authentication is disabled for local development.

## API

`POST /v1/classify` accepts the backend payload. `complaintId` and `location` are retained as compatible request fields; classification uses the title and description.

```bash
curl -X POST http://127.0.0.1:8000/v1/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace_with_ai_service_token" \
  -d '{
    "complaintId": "65f123456789012345678901",
    "title": "Deep pothole near the school",
    "description": "A large pothole is blocking the lane and putting children at risk.",
    "location": {"latitude": 28.6139, "longitude": 77.2090}
  }'
```

Example response:

```json
{
  "category": "Roads",
  "priority": "High",
  "isToxic": false,
  "isSpam": false,
  "confidence": 0.91,
  "reasons": [
    "Roads related keywords detected",
    "Urgent safety or service disruption language detected"
  ]
}
```

`GET /health` returns a lightweight readiness response. Toxicity and spam checks are deliberately conservative heuristics; flagged complaints remain available for human review by the backend workflow.

`POST /v1/image-metadata` accepts multipart field `image` and returns EXIF GPS coordinates and capture time when available. `POST /v1/verify-completion` is an internal backend endpoint that accepts complaint coordinates and before/after Cloudinary image URLs with extracted metadata, then returns `similarityScore`, `gpsMatched`, `gpsDistanceMeters`, `timestampValid`, `fraudScore`, `verificationStatus`, and a review reason. Evidence URLs must use an HTTPS host in `COMPLETION_IMAGE_HOSTS` (defaults to `res.cloudinary.com`). `COMPLETION_SIMILARITY_THRESHOLD` defaults to `0.45`; missing or inconsistent GPS/time evidence returns `needs_review`, not automatic approval.

# StreetSetu AI Classification Service

Flask microservice that classifies civic complaints using a TF-IDF text vectorizer and two Logistic Regression outputs: complaint category and priority.

The service loads only the local `model.pkl` and `vectorizer.pkl` classifier artifacts. It does not download models at runtime. Completion evidence metadata is checked when provided, but visual similarity is disabled on the lightweight service; completion submissions return `needs_review` for an admin to review manually.

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

The development server listens on `http://127.0.0.1:5000` by default and honors the `PORT` environment variable. For a low-memory production WSGI process on Render:

```bash
gunicorn --workers 1 --threads 2 --preload --bind 0.0.0.0:$PORT app:app
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

`POST /v1/image-metadata` accepts multipart field `image` and returns null EXIF fields because optional image-parsing packages are not installed. `POST /v1/verify-completion` accepts complaint coordinates and before/after evidence metadata, returns the existing verification response fields, and always sets `verificationStatus` to `needs_review` for manual review. Visual similarity and automatic approval are disabled to keep runtime memory bounded.

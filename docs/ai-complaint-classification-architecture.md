# AI Complaint Classification Architecture

## Boundary

The backend is the authenticated orchestration boundary. It sends complaint text and location context to an external AI service and validates the response before storing an auditable classification run. The AI service owns model inference; the backend does not silently change complaint category or priority.

## Request Flow

1. An authenticated volunteer or admin calls `POST /api/v1/ai/complaints/:id/classify`.
2. The backend verifies complaint access and sends the complaint payload to `${AI_SERVICE_URL}/v1/classify`.
3. The AI service returns category, priority, toxicity, spam, confidence, and optional reasons.
4. The backend validates every prediction against the complaint domain enums and confidence range `0..1`.
5. The validated result is stored in `ai_runs` with the requesting user, model, and review status.
6. A later human-review workflow can accept or override the pending result.

## AI Service Contract

### Request

```json
{
  "complaintId": "ObjectId",
  "title": "Open drainage near market",
  "description": "Water is blocked near the market road.",
  "location": {
    "type": "Point",
    "coordinates": [77.123, 28.456]
  },
  "categoryOptions": ["drainage", "roads", "other"],
  "priorityOptions": ["low", "medium", "high", "critical"]
}
```

### Response

```json
{
  "model": "complaint-classifier-v1",
  "data": {
    "category": "drainage",
    "priority": "high",
    "isToxic": false,
    "isSpam": false,
    "confidence": 0.94,
    "reasons": ["Drainage blockage and standing water detected"]
  }
}
```

Low-confidence predictions remain reviewable and are not applied automatically.

## Configuration

- `AI_SERVICE_URL`
- `AI_SERVICE_TOKEN`
- `AI_SERVICE_TIMEOUT_MS`

## Failure Behavior

- Missing configuration returns `503 AI_SERVICE_UNAVAILABLE`.
- Provider timeout returns `503 AI_SERVICE_TIMEOUT`.
- Provider HTTP failures return `502 AI_SERVICE_ERROR`.
- Invalid model output returns `502 AI_INVALID_RESPONSE`.
- Classification runs are persisted with `reviewStatus: pending` for human review.

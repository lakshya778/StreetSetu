# StreetSetu AI Service Architecture

## Purpose

Design a production-oriented AI service that supports civic issue classification, severity scoring, duplicate detection, and predictive hotspot analysis for complaint triage and city operations.

This document is architecture and interface-only. No AI service implementation is generated yet.

---

## System Boundary

The AI service must remain independent from the Express API service and should own only inference orchestration, model lifecycle metadata, and explainability artifact generation.

The AI service receives normalized complaint payloads from the API service and returns reviewable predictions with confidence and explanation metadata.

---

## AI Features

1. Issue Classification
2. Severity Scoring
3. Duplicate Detection
4. Predictive Hotspot Analysis

---

## API Contracts

### 1. POST /api/v1/ai/classify

Request body:

```json
{
  "complaintId": "ObjectId",
  "title": "Broken water pipeline in street",
  "description": "Water is leaking near the main junction and creating a traffic obstruction.",
  "categoryHint": "water",
  "wardId": "ObjectId",
  "neighbourhoodId": "ObjectId",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "mediaEvidence": {
    "imageUrls": ["https://storage.example/media/a.jpg"],
    "audioUrl": null,
    "videoUrl": null
  }
}
```

Response body:

```json
{
  "success": true,
  "data": {
    "complaintId": "ObjectId",
    "predictedCategory": "water",
    "confidence": 0.91,
    "reason": "Water infrastructure keywords and location context detected.",
    "reviewRequired": false,
    "modelVersion": "streetsetu-classifier-v1",
    "runId": "ObjectId"
  },
  "message": "Classification completed",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

### 2. POST /api/v1/ai/severity-score

Request body:

```json
{
  "complaintId": "ObjectId",
  "title": "Broken water pipeline in street",
  "description": "Water is leaking near the main junction and creating a traffic obstruction.",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "category": "water",
  "populationDensity": 8500,
  "impactSignals": ["traffic", "health"]
}
```

Response body:

```json
{
  "success": true,
  "data": {
    "complaintId": "ObjectId",
    "severityScore": 86,
    "severityLabel": "high",
    "confidence": 0.84,
    "explanation": "High civic impact based on water leakage and traffic obstruction context.",
    "reviewRequired": true,
    "modelVersion": "streetsetu-severity-v1",
    "runId": "ObjectId"
  },
  "message": "Severity scoring completed",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

### 3. POST /api/v1/ai/duplicates

Request body:

```json
{
  "complaintId": "ObjectId",
  "title": "Broken water pipeline in street",
  "description": "Water is leaking near the main junction and creating a traffic obstruction.",
  "category": "water",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "wardId": "ObjectId"
}
```

Response body:

```json
{
  "success": true,
  "data": {
    "complaintId": "ObjectId",
    "relatedComplaintIds": ["ObjectId", "ObjectId"],
    "duplicateScore": 0.88,
    "status": "pending_review",
    "reason": "Similar title, same ward, same category, and nearby location cluster.",
    "reviewRequired": true,
    "modelVersion": "streetsetu-dedupe-v1",
    "runId": "ObjectId"
  },
  "message": "Duplicate detection completed",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

### 4. POST /api/v1/ai/hotspots

Request body:

```json
{
  "wardId": "ObjectId",
  "timeWindowDays": 30,
  "category": "water",
  "gridResolutionMeters": 250,
  "history": []
}
```

Response body:

```json
{
  "success": true,
  "data": {
    "wardId": "ObjectId",
    "hotspots": [
      {
        "gridId": "ward-12-grid-91",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "riskScore": 0.84,
        "category": "water",
        "incidentCount": 26,
        "reason": "Repeated incidents in the same area"
      }
    ],
    "modelVersion": "streetsetu-hotspot-v1",
    "runId": "ObjectId"
  },
  "message": "Hotspot analysis completed",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

---

## Data Flow

### End-to-End AI Flow

1. API receives a complaint or a complaint update payload.
2. API validates structure, geography, and required metadata.
3. API sends a normalized payload to the AI service.
4. AI service loads the requested workflow model.
5. AI service returns classification, severity, duplicate, and hotspot outputs.
6. API writes the conclusion into a reviewable `ai_runs` or equivalent artifact.
7. Human reviewer validates or rejects the AI decision.
8. Human-approved result is passed into the complaint workflow state machine.

### Internal Data Flow

```text
Complaint Payload
  -> Preprocessing
  -> Feature Extraction
  -> Model Selection
  -> Confidence and Explanation Builder
  -> AI Result Artifact
  -> API Review Queue
```

---

## Model Strategy

### Classification

- Text classifier for complaint title and description.
- Geography-aware category routing.
- Category mapping to departments.

### Severity Scoring

- Runs on title, location, category, ward context, impact signals, and historical complaint density.
- Produces a numerical score and severity label.
- Returns a confidence and explanation for human review.

### Duplicate Detection

- Uses text similarity and spatial proximity.
- Uses category and time closeness.
- Produces a decision with `pending_review` or `accepted` style semantics.

### Hotspot Analysis

- Uses historical complaint density and complaint trends per ward and category.
- Produces geospatial risk scores and collision with known ward or neighbourhood centers.

---

## Training Strategy

### Data Sources

- Historical complaint records
- User-submitted descriptions and media metadata
- GIS and ward/neighbourhood proximity metadata
- Department category mapping
- Previous AI outputs with human review labels

### Training Layers

1. Supervised text and complaint-category learning
2. Severity regression or ordinal classification
3. Duplicate matching pairwise learning
4. Spatial time-series hotspot learning

### Training Rules

- Model predictions must carry confidence and explanation metadata.
- Human-reviewed corrections must be stored as labeled training examples.
- Low-confidence predictions must not auto-route or auto-escalate.
- Training labels must include department and ward context for auditability.
- Every model should have a version and evaluation timestamp.

### Validation Strategy

- Holdout validation by ward and category.
- Bias audit for category and geographic representation.
- Precision-recall metrics for duplicate detection.
- Accuracy and calibration metrics for classification and severity scoring.
- Hotspot model evaluation using geospatial MAE or ranked recall metrics.

### Governance Strategy

- Require human review before any AI result changes issue department or priority.
- Store every AI run in an `ai_runs` artifact collection with run metadata.
- Preserve model confidence, explanation, and feature metadata in the response.
- Do not allow AI service calls to bypass permission checks or audit logs.

---

## Shared Contracts

```ts
export type ComplaintCategory = string;

export interface AiClassificationInput {
  complaintId: string;
  title: string;
  description: string;
  categoryHint?: string;
  wardId?: string;
  neighbourhoodId?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface AiSeverityInput {
  complaintId: string;
  title: string;
  description: string;
  category: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface AiDuplicateInput {
  complaintId: string;
  title: string;
  description: string;
  category: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  wardId: string;
}

export interface AiHotspotInput {
  wardId: string;
  timeWindowDays: number;
  category?: string;
  gridResolutionMeters?: number;
  history?: Array<Record<string, unknown>>;
}
```

---

## Architecture Constraints

1. The AI service must not write directly into business issue lifecycle state without a deterministic API approval path.
2. The AI service must return confidence, explanation, model version, and run metadata for every prediction.
3. Human review must be required for category, severity, duplicate, and routing decisions above confidence thresholds.
4. The AI service must be isolated from web or mobile UI implementation.
5. All AI decisions must remain traceable to the complaint and to the human reviewer.

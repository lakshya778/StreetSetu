# AGENTS.md

## Project Vision

StreetSetu is a civic technology and neighbourhood action intelligence platform that enables citizens, volunteers, ward officers, departments, and city administrators to report civic issues, coordinate neighbourhood action, manage public works, and improve citizen trust through measurable service visibility.

The platform should be designed for Smart India Hackathon quality, production readiness, and real civic governance impact. It must be secure, transparent, maintainable, and capable of operating across citizen reporting, ward coordination, department execution, GIS intelligence, and AI-assisted triage.

---

## Business Goals

1. Enable citizens to report civic issues quickly and clearly with location, category, and media evidence.
2. Convert citizen reports into assignable ward-level and departmental action workflows.
3. Improve transparency and public accountability through visible issue lifecycle tracking.
4. Support local neighbourhood action, community engagement, campaign visibility, and volunteer collaboration.
5. Reduce manual governance work through AI-assisted issue classification, duplicate detection, prioritization, and department routing.
6. Deliver operational insight through dashboards, SLA visibility, reporting, and officer action monitoring.
7. Ensure public trust, fairness, auditability, and secure civic data handling.

---

## Tech Stack

### Recommended Platform Stack

- Backend: Node.js with TypeScript and Express or NestJS-style modular service structure
- Frontend Web: React with Vite or Next.js-compatible architecture
- Mobile: React Native with Expo or React Native CLI
- AI Service: Python with FastAPI, Pydantic, and ML/NLP orchestration pipeline
- Database: MongoDB for operational and document data, with PostgreSQL considered for analytics and relational reporting if required
- File/Object Storage: S3-compatible object storage
- Messaging and Queues: Redis or queue-based background worker service
- GIS: GeoJSON, Leaflet, Mapbox, or OpenStreetMap-compatible geospatial layer
- Containerization: Docker and Docker Compose
- CI/CD: GitHub Actions or equivalent pipeline

### Architecture Principle

Keep the monorepo modular. Do not combine frontend, backend, mobile, AI, worker, and shared contracts into one package. Each service must be independently deployable with clear responsibilities.

---

## Coding Standards

### General Standards

1. Write production-quality, readable, maintainable code.
2. Follow domain-driven organisation and keep business logic out of shared packages.
3. Do not generate placeholder code without architecture context.
4. Use clear file and folder naming conventions.
5. Do not hardcode roles, private paths, civic settings, or sensitive secrets.
6. Avoid duplicate implementations across apps and services.

### Language Standards

- Use TypeScript for backend and web frontend source files.
- Use Python type-safe patterns for AI service code.
- Prefer strongly typed interfaces over loosely typed object payloads.
- Use explicit error classes and structured error objects.
- Avoid `any` unless needed for onboarding or third-party integrations.

### Code Quality Standards

- Use ESLint and Prettier configuration for all JS and TS code.
- Use Ruff, Black, or pyproject-based formatting for Python service code.
- Document all public APIs and major data contracts.
- Use meaningful variable names and business-domain naming.
- Keep services thin and isolate orchestration logic from business workers.

---

## Folder Structure Rules

The repository must maintain a monorepo structure and preserve separation of concerns.

```text
street-neighbourhood-action-platform/
├── apps/
│   ├── web/
│   └── mobile/
├── services/
│   ├── api/
│   ├── ai/
│   └── worker/
├── packages/
│   ├── config/
│   ├── db/
│   ├── shared-ui/
│   ├── types/
│   ├── utils/
│   └── validation/
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── scripts/
└── docs/
```

### Rules

1. `apps/` contains end-user facing applications only.
2. `services/` contains backend or background runtime services.
3. `packages/` contains shared, reusable contracts and non-business-logic utilities.
4. `infrastructure/` contains deployment and environment configuration files.
5. `docs/` contains architecture, API, data model, and implementation design artifacts.
6. Business logic must not be placed directly inside shared packages.
7. Avoid creating domain files directly under the root.

---

## API Design Rules

### REST Principles

1. Keep all API routes versioned as `/api/v1`.
2. Use nouns for resource groups such as `/issues`, `/wards`, `/assets`, `/users`, `/work-orders`.
3. Use standard HTTP methods: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`.
4. Use consistent JSON envelopes.

### Response Standard

All API responses must follow a consistent contract:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

Error responses must include:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": []
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

### API Rules

1. Authentication is required for protected endpoints.
2. Access control must be role-based and permission-based.
3. All issue writes must create an audit event and an `issue_events` log item.
4. Every issue must carry location metadata, category metadata, ward metadata, and issue lifecycle state.
5. AI classification and AI routing endpoints must be human-review capable.
6. API documentation must be updated whenever endpoints change.

---

## Database Design Rules

### Database Policy

Use MongoDB as the primary operational database because StreetSetu requires flexible documents for issues, GIS, reports, AI artifacts, notifications, and event-driven audit records.

### Data Rules

1. All records must include `createdAt`, `updatedAt`, and `createdBy` or `updatedBy` semantics when relevant.
2. Sensitive authentication data must be stored as hashed values only.
3. Use ObjectId relationships and document collections for civic issue and workflow records.
4. Use geospatial fields for ward boundaries, issue coordinates, neighbourhood center points, and street geometry.
5. Use a collection structure that keeps domain records separated by responsibility.
6. Do not put AI outputs into business workflow documents without preserving confidence and explanation metadata.

### Recommended Collections

Users must be able to design and maintain collections for:

- `users`
- `roles`
- `permissions`
- `wards`
- `neighbourhoods`
- `streets`
- `landmarks`
- `departments`
- `categories`
- `issues`
- `issue_events`
- `issue_comments`
- `issue_photos`
- `work_orders`
- `action_tasks`
- `volunteers`
- `community_groups`
- `notifications`
- `audit_logs`
- `ai_runs`
- `ai_dedupe_results`
- `ai_priority_results`
- `reports`
- `asset_registry`
- `inspections`
- `campaigns`
- `service_levels`
- `service_capacity`
- `system_settings`

---

## Security Standards

1. All secrets must be stored in environment variables or secure secret manager configuration.
2. Never commit `.env`, keys, tokens, or private credentials.
3. Use JWT authentication with refresh token support.
4. Use role-based access control and permission checks for every protected endpoint.
5. Enforce owner-scoping such that citizens can access their own issues but not unrelated wards or departments.
6. Validate all user input at the API boundary.
7. Ensure file uploads are scanned, type-validated, and stored safely.
8. All AI decisions must be explainable and reviewable by human operators.
9. Record all role changes, permission changes, issue assignments, and issue state changes in `audit_logs`.
10. Enforce audit trails for security and operations.

---

## Testing Standards

### Required Testing Levels

1. Unit tests for validators, utility functions, role mapping, and request schema rules.
2. Integration tests for APIs, database adapters, and service contracts.
3. Contract tests for shared package type and data contracts.
4. AI service tests for model service integration and pipeline response validation.
5. End-to-end tests for major issue flows: submission, assignment, work order, AI triage, resolution, and closure.

### Testing Rules

- All public APIs must have contract validation tests.
- All schemas and shared types must have unit-level validation checks.
- AI services must include confidence and fallback outputs for failed or low-confidence predictions.
- Do not test mock behavior; test real service boundaries.
- Use real database or test containers where possible.

---

## Git Workflow

### Branch Strategy

Use a clean Git branch strategy:

- `main`: production-ready stable state
- `develop`: integration branch
- `feature/*`: feature-specific work
- `bugfix/*`: issue correction
- `hotfix/*`: production security or urgent correction

### Commit Rules

1. Use clear, conventional commit messages.
2. Commit only logical changes.
3. Every commit should be traceable to a ticket, requirement, or architecture note.
4. Do not commit generated artifacts without documenting the purpose.

### Merge Rules

1. Pull requests require code review.
2. API and schema changes require documentation updates.
3. Security-sensitive changes require explicit review.
4. No merge should bypass tests and linting requirements.

---

## Documentation Standards

1. Every major module must have a clear README or architecture note.
2. API changes must be documented in the API design document.
3. Data model changes must be documented in the database schema document.
4. AI workflows must include model purpose, input shape, confidence strategy, and human review logic.
5. Add diagrams or structured domain mapping if the issue is cross-service or cross-team.
6. Keep docs production-oriented and implementation-ready.
7. Use Markdown for all written design documents.

---

## Delivery Principles

1. Start with the issue lifecycle and permissions foundation.
2. Add data integrity, workflow, and audit requirements before AI scaling.
3. Keep GIS, AI, and public transparency layers reviewable and human-governed.
4. Optimize for trust, clarity, and measurable civic impact.
5. Do not let the frontend or mobile app bypass the server-side permission model.

This document is the permanent coding and delivery instruction set for StreetSetu development.

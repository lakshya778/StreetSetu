# Architecture Decisions

## 1. Monorepo Boundaries

- `apps/web` contains the web frontend.
- `apps/mobile` contains the React Native mobile application.
- `services/api` contains the TypeScript backend API service.
- `services/ai` contains the Python AI service.
- `services/worker` contains background queue workers and scheduled jobs.
- `packages/*` contains shared, non-business-logic cross-cutting packages.

## 2. Technology Decisions

- Backend API: TypeScript service with Express or a similar Node.js HTTP framework.
- Frontend: React or Vite-based web application.
- Mobile: React Native with Expo or bare React Native configuration.
- AI service: Python FastAPI service with Pydantic and ML model pipelines.
- Database: PostgreSQL relational schema with Prisma or TypeORM patterns.
- Object storage: S3-compatible storage for report photos and evidence files.
- Queue: Redis-backed queue or message broker for asynchronous jobs.

## 3. Shared Package Contracts

- Types package: shared domain and API contracts.
- Config package: environment and runtime configuration.
- Validation package: reusable schema and payload validation.
- Utilities package: formatting, geospatial, and metadata helpers.
- DB package: migrations, ORM, repository, and schema patterns.
- Shared UI package: reusable design system and UI components.

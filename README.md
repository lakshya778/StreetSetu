# Street Neighbourhood Action Platform — Production Monorepo Architecture

## Architecture Overview

This repository implements a production-oriented monorepo for the Street Neighbourhood Action Platform. It separates concerns into independent packages while sharing domain contracts, validation rules, database schemas, and environment configuration.

## Monorepo Layout

```text
street-neighbourhood-action-platform/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── mobile/
│       ├── src/
│       ├── app.json
│       └── package.json
├── services/
│   ├── api/
│   │   ├── src/
│   │   └── package.json
│   ├── ai/
│   │   ├── src/
│   │   ├── requirements.txt
│   │   └── pyproject.toml
│   └── worker/
│       ├── src/
│       └── package.json
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
├── docs/
│   └── architecture.md
├── docker-compose.yml
└── tsconfig.base.json
```

## Architecture Decisions

1. Backend structure
   - The API service is the authoritative service for citizens, ward officers, department owners, and admin workflows.
   - The API service owns HTTP routing, authentication middleware, authorisation boundaries, and issue lifecycle orchestration.
   - The service is designed as a TypeScript service layer with separate route, controller, middleware, and service domains.

2. Frontend structure
   - The web application provides the civic portal, ward dashboard, admin console, analytics dashboard, and public reports UI.
   - UI pages should be divided by domain concern: issue reporting, dashboard, workflows, GIS, administration, and public communication.
   - Shared UI components and visual design primitives are isolated into the shared UI package.

3. React Native structure
   - The mobile application is a citizen and field-operations application for issue submission, issue visibility, location capture, and officer check-in workflows.
   - It uses navigation, screen, and service layers separate from the shared UI package.

4. Python AI service structure
   - The AI service is an independent Python service that handles issue classification, duplicate detection, severity/priority scoring, and natural-language summarization.
   - AI components are isolated into API, schema, pipeline, and modeling blocks.

5. Database layer
   - The database package owns persistence contracts, migration structure, repository abstractions, and schema definitions.
   - PostgreSQL is the recommended primary relational database for issues, user roles, work orders, wards, and workflow state.
   - Redis and object storage are handled through infrastructure services.

6. Shared utilities
   - Shared packages are restricted to reusable architectural contracts and non-business-logic elements such as environment configuration, type contracts, validation pipelines, common utility functions, and shared UI primitives.

## Development Strategy

- Foundation phase: configure repository, authentication, environment configuration, and base API services.
- Issue intake phase: implement issue reporting, issue categories, location metadata, and photo storage contracts.
- Workflow and operations phase: implement the issue lifecycle, department assignment, ward ownership, and work orders.
- AI intelligence phase: connect the Python AI service with issue classification, duplicate detection, prioritization, and summary generation.
- Governance and analytics phase: deliver dashboards, SLA metrics, ward reporting, and audit trails.

## Cross-Service Contracts

- Roles and permissions are shared through the types and validation packages.
- Issue and user records are represented by common shared contracts.
- AI services consume the same domain types and issue payload conventions used by the API service.
- Notification and background jobs are executed through the worker service using queue-backed event contracts.

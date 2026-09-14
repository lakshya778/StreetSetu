# StreetSetu Migration Plan

## Objective

Move the repository from the current monorepo architecture to a traditional MERN architecture with:

```text
StreetSetu/
├── frontend/     (React)
├── backend/      (Node.js + Express)
├── docs/
└── README.md
```

This plan preserves the existing documentation and PRD files while creating the requested top-level delivery structure.

## Current State

The existing repository contains a monorepo layout with:

- `apps/web` for the web application
- `apps/mobile` for the mobile application
- `services/api` for the backend API service
- `services/ai` for the AI service
- `services/worker` for background workers
- `packages/*` for reusable packages
- `docs/*` for architecture and PRD documentation

## Target State

The repository will adopt a traditional MERN structure that separates the delivery units into:

- `frontend/` for the React application
- `backend/` for the Node.js + Express service
- `docs/` for architecture and product documentation
- `README.md` for project onboarding and repository-level guidance

## Migration Steps

### Phase 1 — Repository Freeze and Documentation Preservation

1. Preserve the generated documentation artifacts, PRD content, architecture decisions, and API design documents.
2. Mark the existing monorepo architecture as a legacy implementation path.
3. Freeze business logic implementation until the migration structure is clearly separated.

### Phase 2 — Top-Level Structure Creation

1. Create the top-level `frontend/` directory as the React application home.
2. Create the top-level `backend/` directory as the Node.js + Express service home.
3. Keep the existing `docs/` directory for all design, API, schema, and migration documents.
4. Keep the root `README.md` as the repository introduction and migration note.

### Phase 3 — Source Grounding and Boundary Mapping

1. Map the current `apps/web` code and assets into `frontend/`.
2. Map the current `services/api` source and route layers into `backend/`.
3. Retain shared documentation, requirements, and PRD artifacts without changing implementation behavior.
4. Keep database, AI, and worker concerns documented for later implementation sequencing.

### Phase 4 — Dependency and Configuration Migration

1. Create package manifests in the new top-level directories.
2. Move environment and dependency configuration from the monorepo root into the backend and frontend folders.
3. Remove or deprecate duplicated workspace package configuration after the migration is reviewed.

### Phase 5 — Cutover Readiness

1. Confirm that all front-end-facing source is rooted under `frontend/`.
2. Confirm that all back-end API source is rooted under `backend/`.
3. Confirm that the PRD and documentation remain authoritative and unchanged.
4. Confirm that no business logic is implemented as part of the migration preparation.

## Migration Mapping

| Current Repository Area | Future Repository Area |
| --- | --- |
| `apps/web` | `frontend/` |
| `services/api` | `backend/` |
| `docs/` | `docs/` |
| `README.md` | `README.md` |
| `apps/mobile` | Deferred to future optional mobile scope |
| `services/ai`, `services/worker` | Deferred or relocated based on product scope |

## Constraints

- Preserve all existing documentation and PRD files.
- Do not implement business logic during this migration preparation.
- Do not modify current service or application source behavior.
- Ensure all source code stays outside the migration plan and remains documentation-safe.

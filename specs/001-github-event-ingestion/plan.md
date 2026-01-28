# Implementation Plan: GitHub Event Ingestion Backend

**Branch**: `001-github-event-ingestion` | **Date**: 2026-01-27 | **Spec**: [spec.md](file:///home/grisolfi/Dev/missing-actions-monitoring/specs/001-github-event-ingestion/spec.md)
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a high-throughput, fail-safe backend for ingesting GitHub webhook events. The system uses Fastify for performance and BullMQ (Redis) for durable asynchronous processing. Key improvements include idempotent delivery handling, 30-day raw payload retention, and atomic database transactions to ensure consistency between workflow runs and job states.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Node.js 24+  
**Primary Dependencies**: Fastify, BullMQ, Redis, Prisma, @octokit/webhooks-methods  
**Storage**: PostgreSQL  
**Testing**: Jest, Fastify-Inject, Artillery (Load testing)  
**Target Platform**: Docker / Linux  
**Project Type**: Web application (Backend + Frontend)  
**Performance Goals**: 50+ events/sec, <500ms ack time  
**Constraints**: <200ms p95 for acknowledgment, durably queued events, idempotent handlers  
**Scale/Scope**: Organization-wide handling (10.000+ repos)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Does this plan follow the **I. Organization-Wide Visibility** principle? (Yes, processes all org-level webhooks)
- [x] Is the architecture **III. Event-Driven**? (Yes, uses BullMQ for async processing)
- [x] Does it respect the **V. Modular Full-Stack** separation? (Yes, backend-only feature)

## Project Structure

### Documentation (this feature)

```text
specs/001-github-event-ingestion/
├── plan.md              # This file
├── research.md          # Technology decisions
├── data-model.md        # DB entities
├── quickstart.md        # Local setup
├── contracts/           # API definitions
└── tasks.md             # Implementation tasks (Phase 2)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Prisma models
│   ├── services/        # BullMQ workers
│   └── api/             # Fastify routes
├── prisma/              # Schema and migrations
└── tests/
    ├── contract/
    ├── integration/
    └── load/            # Artillery tests
```

**Structure Decision**: Option 2: Web application (frontend + backend). We will focus on the `backend/` structure for this feature.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

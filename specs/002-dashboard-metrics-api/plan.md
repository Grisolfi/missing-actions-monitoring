# Implementation Plan: Dashboard Metrics API

**Branch**: `002-dashboard-metrics-api` | **Date**: 2026-02-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-dashboard-metrics-api/spec.md`

## Summary

This feature implements a unified metrics API to provide organization-wide visibility into GitHub Actions. It exposes real-time counts of running and queued workflows, aggregate performance statistics (average wait time, duration, success rates), and time-series data via a single secured endpoint (`GET /api/dashboard/summary`).

## Technical Context

**Language/Version**: Node.js 25+  
**Primary Dependencies**: Fastify, Prisma, BullMQ, Redis  
**Storage**: PostgreSQL  
**Testing**: Integrated integration and load tests  
**Target Platform**: Docker (Chainguard Node image)  
**Project Type**: Web Application (Backend API)  
**Performance Goals**: < 500ms p95 for 10k records  
**Constraints**: 30-day retention window; Secured via Shared API Key  
**Scale/Scope**: Aggregated metrics for an entire GitHub Organization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Does this plan follow the **I. Organization-Wide Visibility** principle? (No manual repo config)
- [x] Is the architecture **III. Event-Driven**? (Consumes data from the event pipeline)
- [x] Does it respect the **V. Modular Full-Stack** separation? (Backend API)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── dashboard.ts  # [NEW] Unified summary endpoint
│   │   └── schemas/
│   │       └── dashboard.ts  # [NEW] Validation schemas
│   ├── plugins/
│   │   └── auth.ts           # [NEW] X-API-Key validation hook
│   └── prisma/
│       └── schema.prisma     # [MODIFY] Add indexes for performance
└── tests/
    ├── contract/
    │   └── dashboard.test.ts # [NEW] OpenAPI compliance
    └── integration/
        └── dashboard.test.ts # [NEW] Metrics calculation logic
```

**Structure Decision**: Web application backend pattern. We will use the existing `backend/src/api` structure for routes and schemas, adding a dedicated dashboard route.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

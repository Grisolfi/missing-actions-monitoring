# Tasks: Dashboard Metrics API

**Input**: Design documents from `/specs/002-dashboard-metrics-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are specific to the `backend/` project structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and security configuration

- [ ] T001 [P] Configure `DASHBOARD_API_KEY` in `.env` and update schema in `backend/src/utils/env.ts`
- [ ] T002 [P] Create API route placeholder in `backend/src/api/routes/dashboard.ts`
- [ ] T003 [P] Create validation schemas in `backend/src/api/schemas/dashboard.ts` based on OpenAPI contract

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database performance and security isolation

- [ ] T004 [P] Add indexes to `WorkflowRun` for `repositoryName`, `startedAt`, `completedAt`, and `status` in `backend/prisma/schema.prisma`
- [ ] T005 [P] Implement `X-API-Key` validation hook in `backend/src/plugins/auth.ts`
- [ ] T006 Register the auth plugin and dashboard routes in `backend/src/api/server.ts`

---

## Phase 3: User Story 1 - Real-Time Workflow Visibility (Priority: P1) 🎯 MVP

**Goal**: Expose current counts of running and queued workflows across the organization.

**Independent Test**: Query `GET /api/dashboard/summary` and verify `current_state.running` and `current_state.queued` reflect the real database state.

### Tests for User Story 1
- [ ] T007 [P] [US1] Create contract test in `backend/tests/contract/dashboard.test.ts` to verify basic response structure
- [ ] T008 [P] [US1] Create integration test in `backend/tests/integration/dashboard.test.ts` to verify counts and 1-minute accuracy window (SC-002)

### Implementation for User Story 1
- [ ] T009 [US1] Implement summary logic for `running`/`queued` counts with null-safe zero handling (FR-006) in `backend/src/api/routes/dashboard.ts` using Prisma
- [ ] T010 [US1] Integrate `X-API-Key` auth plugin for the dashboard route

---

## Phase 4: User Story 2 - Performance Analysis (Priority: P2)

**Goal**: Expose average wait time and execution duration with repository filtering support.

**Independent Test**: Query the API with a `repository` filter and verify `aggregates.average_wait_time` and `aggregates.average_duration`.

### Tests for User Story 2
- [ ] T011 [P] [US2] Expand integration test in `backend/tests/integration/dashboard.test.ts` to verify average calculations and repository filtering

### Implementation for User Story 2
- [ ] T012 [US2] Implement aggregation logic for wait time and duration in `backend/src/api/routes/dashboard.ts`
- [ ] T013 [US2] Add support for `repositoryName` and `timeRange` filtering in the Prisma query logic

---

## Phase 5: User Story 3 - Reliability Monitoring (Priority: P3)

**Goal**: Expose success rates and 30-minute time-series data points.

**Independent Test**: Verify `aggregates.success_rate` and the `time_series` array (confirming 30-minute buckets over the last 24h).

### Tests for User Story 3
- [ ] T014 [P] [US3] Expand integration test in `backend/tests/integration/dashboard.test.ts` to verify success rate calculations and time-series bucketing

### Implementation for User Story 3
- [ ] T015 [US3] Implement success rate calculation (percentage 0-100) in `backend/src/api/routes/dashboard.ts`
- [ ] T016 [US3] Implement 30-minute bucket aggregation using Postgres `date_trunc` and `generate_series` via raw Prisma query

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Update `backend/README.md` with Dashboard API documentation
- [ ] T018 Run final validation using `specs/002-dashboard-metrics-api/quickstart.md`
- [ ] T019 [P] Performance check: Ensure p95 response time < 500ms with 10k mock records (SC-001)
- [ ] T020 Load test: Verify system handles 20 concurrent requests without latency spike (>2x) (SC-003)

---

## Dependencies & Execution Order

1. **Setup (Phase 1)** & **Foundational (Phase 2)** can run mostly in parallel but MUST be complete before US1.
2. **User Stories** follow priority (P1 → P2 → P3). 
3. **Database Migration** (T004) is required before any query-based implementation.
4. **Auth Plugin** (T005) is required before securing the endpoint (T010).

## Implementation Strategy
- **MVP**: Complete Phase 1, 2, and 3 (User Story 1). This delivers immediate value.
- **Incremental**: Add US2 (averages) followed by US3 (time-series) in sequential order.

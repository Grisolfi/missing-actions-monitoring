# Tasks: GitHub Event Ingestion Backend

**Input**: Design documents from `specs/001-github-event-ingestion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included as per the "Fail Safe" and "Consistency" requirements in the specification.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure: `backend/src/{api,models,services,utils}`, `backend/prisma`, `backend/tests/{contract,integration,load}`
- [ ] T002 [P] Initialize Node.js 24 project in `backend/` and install dependencies (fastify, bullmq, prisma, @octokit/webhooks-methods)
- [ ] T003 [P] Configure TypeScript and ESLint for the backend

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure for event-driven architecture

- [ ] T004 Setup Prisma schema with `WebhookEvent`, `WorkflowRun`, and `WorkflowJob` models (include unique `externalId` and `status` enum) in `backend/prisma/schema.prisma`
- [ ] T005 [P] Setup Redis and BullMQ connection utility in `backend/src/services/queue.ts`
- [ ] T006 [P] Configure Fastify server with global error handling (structured logging of failed requests) and pino logging in `backend/src/api/server.ts`
- [ ] T007 Implement signature verification and idempotency check utilities in `backend/src/utils/github-webhook.ts`

---

## Phase 3: User Story 1 - Real-Time Workflow Ingestion (Priority: P1) 🎯 MVP

**Goal**: Receive, deduplicate, and queue GitHub events

### Independent Test for US1
Send a mock GitHub webhook with a unique `X-GitHub-Delivery` ID twice. Verify first call returns 202 and second call returns 202 but skips processing (status `SKIPPED_DUPLICATE`).

### Implementation for User Story 1
- [ ] T008 [P] [US1] Implement `WebhookEvent` model CRUD (with uniqueness check) in `backend/src/models/event.ts`
- [ ] T009 [US1] Create Fastify route `POST /webhooks/github` that validates signature, headers, and performs idempotency check in `backend/src/api/routes/webhooks.ts`
- [ ] T010 [US1] Add event persistence to the webhook route (Store raw payload with `PENDING` status)
- [ ] T011 [US1] Add BullMQ producer to the webhook route (Queue event ID for processing)
- [ ] T012 [US1] Integration test: Sending mock webhook results in 202 and event in DB with `PENDING` status in `backend/tests/integration/ingestion.test.ts`

---

## Phase 4: User Story 2 - High-Throughput Load Handling (Priority: P2)

**Goal**: Atomic and concurrent event processing

### Independent Test for US2
Mock a failure in the `WorkflowJob` update. Send a `job_completed` event. Verify that the `WorkflowRun` duration is NOT updated (rollback) and the job remains `PENDING` in the queue for retry.

### Implementation for User Story 2
- [ ] T013 [P] [US2] Implement BullMQ worker to consume event IDs from the queue in `backend/src/services/worker.ts`
- [ ] T014 [US2] Implement workflow processing logic using Prisma `$transaction` to update Run and Job states atomically in `backend/src/services/processor.ts`
- [ ] T015 [US2] Add concurrency configuration to BullMQ worker to handle bursts (at least 50/sec)
- [ ] T016 [US2] Load test: Verify 50+ event/sec throughput with acknowledgment under 200ms in `backend/tests/load/ingestion-load.yml`

---

## Phase 5: User Story 3 - Fail-Safe Event Processing (Priority: P3)

**Goal**: Resilience, Dead-Letter handling, and Data Retention

### Independent Test for US3
Manually set a `WebhookEvent` received timestamp to 31 days ago. Run the cleanup worker and verify the record is deleted.

### Implementation for User Story 3
- [ ] T017 [P] [US3] Configure BullMQ retry policy with exponential backoff for processing failures
- [ ] T018 [US3] Implement failure handling: Mark `WebhookEvent` as `FAILED` and store error details in the database after final retry
- [ ] T019 [US3] Implement daily cleanup worker for `WebhookEvent` records older than 30 days in `backend/src/services/cleanup.ts`
- [ ] T020 [US3] Resiliency test: Verify processing resumes correctly after database reconnection in `backend/tests/integration/resiliency.test.ts`

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Add detailed structured logging (trace IDs) across API and Workers
- [ ] T022 Finalize `README.md` and `quickstart.md` with final API and deployment details

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 2** depends on **Phase 1**
- **Phase 3 (MVP)** depends on **Phase 2**
- **Phase 4 & 5** can be worked on after **Phase 3** is functional

### Parallel Execution Examples
- **Setup & Infrastructure**: T002, T003 can run in parallel.
- **US1 Implementation**: T008 can be developed in parallel with server setup (T006).

### Implementation Strategy
1. **Durable Ingestion first**: Setup the endpoint and raw payload storage (Phase 3). This ensures we capture data even if processing logic (Phase 4) is still being written.
2. **Atomic Processing**: Implement the worker (Phase 4) with strict transactional guarantees.
3. **Resiliency**: Add DLQ and retention logic (Phase 5).

# Feature Specification: GitHub Event Ingestion Backend

**Feature Branch**: `001-github-event-ingestion`  
**Created**: 2026-01-27  
**Status**: Draft  
**Input**: User description: "the backend to receive github events very consistently. We should have strong throughput and fail safe event driven archictecture"

## Clarifications

### Session 2026-01-27
- Q: How should the system handle duplicate webhook deliveries? → A: Idempotent processing using the `X-GitHub-Delivery` ID; skip if already stored.
- Q: What is the retention policy for raw webhook payloads? → A: 30 Days for audit and recovery.
- Q: How should partial failures during event processing be handled? → A: Use atomic database transactions per event to ensure consistent Run/Job updates.
- Q: What is the behavior for events that fail processing after all retries? → A: Mark the `WebhookEvent` record status as `FAILED` and store error details in the database.
- Q: How are new/existing repositories discovered? → A: Reactive discovery (triggered by first webhook); historical sync is a separate future feature.

## User Scenarios & Testing

### Out of Scope
- Historical data migration/backfill of runs existing before app installation.
- Manual bulk-syncing of organizations via UI (future feature).

### User Story 1 - Real-Time Workflow Ingestion (Priority: P1)

As a DevOps Engineer, I want the system to receive and process GitHub Action events immediately so that my dashboard reflects the current state of my organization's workflows without delay.

**Why this priority**: Essential for the "Real-Time Reliability" principle. Without consistent ingestion, the entire monitoring system is useless.

**Independent Test**: Send a mock GitHub webhook payload to the ingestion endpoint and verify the database is updated with the correct workflow status.

**Acceptance Scenarios**:

1. **Given** a valid `workflow_run` event from GitHub, **When** it hits the ingestion endpoint, **Then** the backend MUST return a 202 Accepted response within 500ms.
2. **Given** a received event, **When** processed asynchronously, **Then** the corresponding metric (e.g., Running Workflows) MUST update in the database correctly.

---

### User Story 2 - High-Throughput Load Handling (Priority: P2)

As a Platform Admin, I want the system to handle bursts of GitHub events during peak CI/CD hours so that no monitoring data is lost when many workflows start or end simultaneously.

**Why this priority**: Crucial for scalability in large organizations.

**Independent Test**: Load test the endpoint with 100 concurrent requests per second and verify zero lost events.

**Acceptance Scenarios**:

1. **Given** a burst of 100 events/second, **When** sent to the API, **Then** all events MUST be queued successfully and processed without dropping data.

---

### User Story 3 - Fail-Safe Event Processing (Priority: P3)

As a System Reliability Engineer, I want the ingestion pipeline to be resilient to downstream failures (e.g., database downtime) so that events are eventually processed even if a component is temporarily unavailable.

**Why this priority**: Ensures "fail-safe" architecture as requested by the user.

**Independent Test**: Mock a database failure, send a webhook, then restore the database and verify the event is eventually processed.

**Acceptance Scenarios**:

1. **Given** a temporary failure in the persistence layer, **When** an event is received, **Then** it MUST be held in a retry queue or buffer and re-processed upon recovery.

## Requirements

### Functional Requirements

- **FR-001**: System MUST expose a secure POST endpoint to receive GitHub Webhooks.
- **FR-002**: System MUST validate the `X-Hub-Signature-256` header to ensure requests originate from GitHub.
- **FR-003**: System MUST acknowledge webhook receipt (HTTP 202) BEFORE performing heavy processing or database writes.
- **FR-004**: System MUST delegate event processing to an asynchronous worker queue.
- **FR-005**: System MUST perform derived state updates (e.g., Run and Job status) within an atomic database transaction per event.
- **FR-006**: System MUST log and store raw payloads for audit and manual recovery if processing fails. Payloads MUST be retained for 30 days.
- **FR-007**: System MUST handle at least the following events: `workflow_run`, `workflow_job`.
- **FR-008**: System MUST perform idempotency checks using the `X-GitHub-Delivery` header to prevent duplicate processing of the same event.
- **FR-009**: System MUST mark `WebhookEvent` records as `FAILED` if asynchronous processing fails after all configured retries.

### Key Entities

- **WebhookEvent**: Represents a raw payload received from GitHub, including metadata (ID, timestamp, event type).
- **WorkflowRun**: The derived high-level state of a GitHub Action workflow execution.
- **WorkflowJob**: Individual job execution within a workflow run.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of valid GitHub webhooks are acknowledged with HTTP 202 within 500ms under normal load.
- **SC-002**: Zero data loss for received events even during 2-minute database outages (assuming queue/buffer availability).
- **SC-003**: System supports a sustained throughput of 50 events per second on base infrastructure.

## Assumptions & Constraints

- **Assumption**: GitHub's webhook delivery retry policy (up to 24 hours) serves as a primary safety net; our backend provides the secondary "fail-safe" within our VPC.
- **Constraint**: Must use an event-driven pattern as per Constitution Principle III.

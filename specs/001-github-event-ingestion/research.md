# Research: GitHub Event Ingestion Backend

## Decision: Fastify for Backend API
- **Rationale**: Fastify provides significantly higher throughput than Express and has a lower overhead, matching the "strong throughput" requirement. It also has excellent schema validation which helps with JSON payload consistency.
- **Alternatives considered**: Express (too slow/legacy for this specific high-throughput need), Go/Rust (out of scope for "API Node" requirement).

## Decision: GitHub Webhook Secret Validation
- **Decision**: Validate `X-Hub-Signature-256` using `crypto.createHmac` before any processing.
- **Rationale**: Security requirement from FR-002.

### Idempotency Pattern
- **Decision**: Use `externalId` (GitHub Delivery ID) as a unique constraint in the `WebhookEvent` table.
- **Rationale**: Prevents duplicate processing of the same event as clarified in Session 2026-01-27.

### Data Retention (Cleanup)
- **Decision**: Implement a daily cleanup worker (using BullMQ repeatable job) to delete `WebhookEvent` records older than 30 days.
- **Rationale**: Clarified retention policy to manage storage growth.

### Processing Atomicity
- **Decision**: Use Prisma `$transaction` API when updating `WorkflowRun` and `WorkflowJob` states in the worker.
- **Rationale**: Ensures data consistency if one part of the multi-entity update fails.

## Decision: BullMQ (Redis) for Event Queuing
- **Rationale**: To ensure a "fail-safe event driven architecture", events must be durably queued before processing. BullMQ on Redis is industry-standard for Node.js, supporting retries, delayed jobs, and high concurrency.
- **Alternatives considered**: In-memory queue (lost on crash), RabbitMQ (heavier to setup for MVP).

## Decision: PostgreSQL + Prisma
- **Rationale**: Prisma provides a type-safe interface for the metrics database. PostgreSQL is reliable and can handle time-series data reasonably well for an MVP.
## Decision: GitHub Webhook Secret Validation
- **Rationale**: Mandatory for security. Will use `crypto` to verify `X-Hub-Signature-256`.

# Research: Dashboard Metrics API

## Decision: Time-Series Aggregation Pattern
**Decision**: Use PostgreSQL's `date_trunc` and `generate_series` via Prisma raw queries for bucketing.
**Rationale**: Calculating 30-minute buckets over 24 hours is most efficiently done in the database. `generate_series` ensures we get zeroed buckets even if no data exists for a specific period, satisfying FR-006.
**Alternatives considered**: 
- In-memory JS aggregation: Simple but inefficient for large datasets (SC-001) and complex to fill gaps (zeroed buckets).
- Prisma `.groupBy`: Easier to use but doesn't handle empty buckets natively and has limited support for complex time-based grouping without raw SQL.

## Decision: API Security
**Decision**: Fastify `preHandler` hook.
**Rationale**: A dedicated scope-level hook for the `/api/dashboard/*` routes allows us to centralize `X-API-Key` validation without Repeating logic in every route.
**Alternatives considered**: 
- Fastify Plugin: More modular but potentially overkill for a single middleware requirement.
- Inline validation: Fragile and hard to maintain across multiple metrics endpoints.

## Decision: Aggregation Performance
**Decision**: Add indexes on `startedAt` and `completedAt` in `WorkflowRun` and `WorkflowJob`.
**Rationale**: All dashboard queries are time-boxed. Without indexes, SC-001 (<500ms) will fail as the dataset grows towards 10k+ records.
**Alternatives considered**:
- Materialized Views: Great for performance but adds complexity to the "Real-Time" requirement (SC-002) as they need refreshing.

## Decision: Wait Time Calculation
**Decision**: Use `waitTime` from `WorkflowRun`.
**Rationale**: The `001` ingestion already calculates this during processing. We just need to aggregate the values.

# Data Model: Dashboard Metrics API

## Updates to Existing Models

The dashboard implementation requires high-performance filtering over time and repository. We will add indexes to the following models.

### [WorkflowRun](file:///home/grisolfi/Dev/missing-actions-monitoring/backend/prisma/schema.prisma#L32)

| Field | Type | Note |
|-------|------|------|
| repositoryName | String | Filtered (Needs Index) |
| startedAt | DateTime | Bucketed (Needs Index) |
| completedAt | DateTime? | Bucketed (Needs Index) |
| status | String | Filtered (`queued`, `in_progress`, `completed`) |
| duration | Int? | Aggregated (Seconds) |
| waitTime | Int? | Aggregated (Seconds) |

### [WorkflowJob](file:///home/grisolfi/Dev/missing-actions-monitoring/backend/prisma/schema.prisma#L45)

| Field | Type | Note |
|-------|------|------|
| startedAt | DateTime | Needed for job-level metrics |
| completedAt | DateTime? | Needed for job-level metrics |

## Proposed Indexes

```prisma
model WorkflowRun {
  // ... existing fields
  
  @@index([repositoryName])
  @@index([startedAt])
  @@index([completedAt])
  @@index([status])
}
```

# Data Model: GitHub Event Ingestion

## Entities

### WebhookEvent
Used to store raw payloads for audit and fail-safe recovery.

- `id`: UUID (Primary Key)
- `externalId`: String (GitHub delivery ID - **Unique Index**)
- `eventType`: String (e.g., "workflow_run")
- `payload`: JSONB (Raw GitHub payload)
- `status`: Enum (PENDING, PROCESSED, FAILED, SKIPPED_DUPLICATE)
- `error`: Text (Optional error message)
- `receivedAt`: DateTime
- `processedAt`: DateTime (Optional)

### WorkflowRun
The derived state of a workflow.

- `id`: BigInt (GitHub Run ID - Primary Key)
- `repositoryName`: String
- `workflowName`: String
- `status`: String (queued, in_progress, completed)
- `conclusion`: String (success, failure, cancelled, etc.)
- `startedAt`: DateTime
- `completedAt`: DateTime (Optional)
- `duration`: Int (Seconds, calculated on completion)
- `waitTime`: Int (Seconds from trigger to start)

### WorkflowJob
Individual unit of execution within a run. 

- `id`: BigInt (GitHub Job ID - Primary Key)
- `runId`: BigInt (GitHub Run ID - Foreign Key to WorkflowRun)
- `name`: String
- `status`: String (queued, in_progress, completed)
- `conclusion`: String (success, failure, cancelled, etc. - Optional)
- `startedAt`: DateTime
- `completedAt`: DateTime (Optional)

## Relationships
- `WebhookEvent` maps to a `WorkflowRun` or `WorkflowJob` update.
- `WorkflowRun` has many `WorkflowJob` records.

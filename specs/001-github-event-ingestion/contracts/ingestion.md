# API Contract: Webhook Ingestion

## POST /webhooks/github

Receives events from GitHub.

### Headers
- `X-GitHub-Event`: The type of event (e.g., `workflow_run`)
- `X-Hub-Signature-256`: SHA256 signature for verification
- `X-GitHub-Delivery`: Unique delivery ID for idempotency

### Request Body
Standard GitHub Webhook JSON payload.

### Responses

#### 202 Accepted
- **Condition**: Signature is valid and event is queued for processing.
- **Payload**: `{"status": "accepted", "id": "uuid"}`

#### 401 Unauthorized
- **Condition**: `X-Hub-Signature-256` is missing or invalid.

#### 400 Bad Request
- **Condition**: Missing required headers or invalid JSON.

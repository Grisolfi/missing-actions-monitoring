# Quickstart: GitHub Event Ingestion Backend

## Setup

1. **Environment Variables**:
   ```bash
   PORT=3000
   REDIS_URL=redis://localhost:6379
   DATABASE_URL=postgresql://user:pass@localhost:5432/metrics
   GITHUB_WEBHOOK_SECRET=your_secret_here
   ```

2. **Dependencies**:
   ```bash
   npm install
   ```

3. **Database Migration**:
   ```bash
   npx prisma migrate dev
   ```

## Development

```bash
npm run dev
```

## Testing

### Mock GitHub Event
Use `curl` or a tool like `ngrok` to send a signed payload:

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "X-GitHub-Event: workflow_run" \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "X-GitHub-Delivery: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" \
  -d @specs/001-github-event-ingestion/contracts/samples/workflow_run.json
```

### Load Testing
```bash
npx artillery run specs/001-github-event-ingestion/tests/load-test.yml
```

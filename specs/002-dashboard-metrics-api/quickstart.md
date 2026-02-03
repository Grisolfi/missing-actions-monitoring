# Quickstart: Dashboard Metrics API

## Setup

1. Ensure documentation and design artifacts are generated:
   - `specs/002-dashboard-metrics-api/contracts/dashboard.openapi.yml`
   - `specs/002-dashboard-metrics-api/data-model.md`

2. Set the `DASHBOARD_API_KEY` in your `.env` file:
   ```bash
   DASHBOARD_API_KEY=your-dev-key-123
   ```

## Verifying the API

### 1. Request Dashboard Summary
```bash
curl -X GET "http://localhost:3000/api/dashboard/summary" \
     -H "X-API-Key: your-dev-key-123"
```

### 2. Request with Filters
```bash
curl -X GET "http://localhost:3000/api/dashboard/summary?repository=my-repo&start_date=2026-02-01T00:00:00Z" \
     -H "X-API-Key: your-dev-key-123"
```

### 3. Verification Steps
- **Success**: 200 OK with JSON containing `current_state`, `aggregates`, and `time_series`.
- **Auth Failure**: 401 Unauthorized if `X-API-Key` is missing or incorrect.
- **No Data**: 200 OK with zeroed counts (as per FR-006).

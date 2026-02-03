# Feature Specification: Dashboard Metrics API

**Feature Branch**: `002-dashboard-metrics-api`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "The next logical step in the roadmap is to expose the collected data through a Dashboard Metrics API. This will allow us to visualize: Running & Queued Workflows, Average Wait Time, Execution Statistics (Total time, success rates)"

## Clarifications

### Session 2026-02-02

- Q: Success Rate Format → A: **Percentage** (0-100).
- Q: Time Range Defaults → A: **Last 24 Hours** (Default window if none specified).
- Q: Metric Bucketing (Granularity) → A: **30-minute intervals** (Default for time-series aggregation).
- Q: Endpoint Structure → A: **Unified Dashboard Endpoint** (Single request for all primary metrics).
- Q: Authentication/Security → A: **Shared API Key** (Header `X-API-Key`).

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
-->

### User Story 1 - Real-Time Workflow Visibility (Priority: P1)

As an operations manager, I want to see the current count of running and queued workflows across the entire organization so that I can identify if there are any immediate bottlenecks in our CI/CD pipeline.

**Why this priority**: This is the most critical operational metric for immediate awareness. It allows users to see if the system is currently "clogged".

**Independent Test**: Can be fully tested by triggering several workflows (some expected to queue, some to run), then querying the metrics API and verifying that the counts of `queued` and `in_progress` states match the real-world state of GitHub Actions.

**Acceptance Scenarios**:

1. **Given** 5 workflows are currently "in_progress" and 2 are "queued" in the system, **When** I request the dashboard summary, **Then** I should see "5 Running" and "2 Queued" in the response.
2. **Given** all workflows have completed, **When** I request the dashboard summary, **Then** I should see "0 Running" and "0 Queued".

---

### User Story 2 - Performance Analysis (Priority: P2)

As a DevOps engineer, I want to see the average wait time and execution duration for workflows over a period of time (e.g., last 24 hours) so that I can determine if we need to provision more runners or optimize specific workflows.

**Why this priority**: Helps with capacity planning and cost optimization, which are key for maturing the CI/CD platform.

**Independent Test**: Can be tested by seeding the database with workflow runs that have known `waitTime` and `duration` values over a specific time window, then querying the API for that window and verifying the averages.

**Acceptance Scenarios**:

1. **Given** multiple workflow runs completed in the last hour with an average wait time of 45 seconds, **When** I request metrics for the "last hour", **Then** the `average_wait_time` returned should be 45 seconds.
2. **Given** a specific repository "app-main", **When** I request metrics filtered by that repository, **Then** I should see the duration and wait time averages specifically for that repository.

---

### User Story 3 - Reliability Monitoring (Priority: P3)

As a developer lead, I want to see the success and failure rates of workflows across different repositories so that I can identify unstable projects or common failure patterns.

**Why this priority**: Important for quality monitoring, though often secondary to knowing if things are running at all.

**Independent Test**: Can be tested by triggering a mix of successful and failed workflows, then querying the API for success rates and verifying the calculation.

**Acceptance Scenarios**:

1. **Given** 10 workflows ran today, with 8 succeeding and 2 failing, **When** I request the daily statistics, **Then** the success rate should be reported as 80%.

---

### Edge Cases

- **No Data**: How does the system handle a time range or filter where no workflow runs exist? (Should return zeroed metrics, not errors).
- **In-Progress Runs**: How are currently running workflows accounted for in "average duration" calculations? (Typically excluded until completion to avoid skewing data).
- **Massive Data Volume**: How does the system handle aggregations over very large timeframes (e.g., 30 days with thousands of runs)?

## Dependencies & Assumptions

- **Assumption**: All time-based metrics are calculated based on the timestamp the event was received by our system, unless the GitHub payload provides a more accurate execution timestamp (which we use when available).
- **Assumption**: "Running" status corresponds to either `in_progress` or `queued` states in GitHub, but we expose them as separate counts.
- **Dependency**: Requires the data collected by the `001-github-event-ingestion` feature to be present in the database.
- **Constraint**: Aggregations are limited to the data retention period (currently 30 days as per ingestion spec).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a **unified endpoint** (`GET /api/dashboard/summary`) to retrieve current organization-wide workflow states (`queued`, `in_progress`), aggregate stats, and time-series data.
- **FR-002**: System MUST provide an endpoint to retrieve aggregate metrics (`average_wait_time`, `average_duration`, `total_executions`, `success_rate` as a **percentage 0-100**).
- **FR-003**: System MUST allow filtering of aggregate metrics by a time range (start and end timestamps). **Default window MUST be the last 24 hours** if no range is provided.
- **FR-004**: System MUST allow filtering of metrics by `repositoryName`.
- **FR-005**: System MUST return metrics in a structured format (JSON) suitable for dashboard visualization.
- **FR-006**: System MUST handle cases where no data is found for a given filter by returning a null-safe response (e.g., zeros for counts).
- **FR-007**: System MUST secure the Dashboard Metrics API using a **Shared API Key** provided in the `X-API-Key` request header.

### Key Entities *(include if feature involves data)*

- **MetricSummary**: An object containing top-level counts of current states.
- **TimeSeriesMetric**: Data points representing metrics over time, aggregated into **30-minute buckets**.
- **AggregateStat**: A calculated value (average, percentage) over a set of workflow runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: API response time for a standard dashboard summary (all P1/P2 metrics) MUST be under 500ms for a dataset of up to 10,000 records.
- **SC-002**: Metrics MUST be accurate within a 1-minute window of the latest processed event.
- **SC-003**: The API MUST be able to handle at least 20 concurrent requests without a significant increase in latency (>2x).

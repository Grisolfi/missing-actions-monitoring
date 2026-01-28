# Load Testing Guide

We use **Artillery** to perform load testing on the GitHub Action Ingestion API. This helps verify that the Fastify + BullMQ architecture can handle high-throughput bursts while maintaining low response times.

## Prerequisites

1.  **Install Artillery**:
    ```bash
    npm install -g artillery
    ```
2.  **App Running**: The backend must be running (either locally via `npm run dev` or via `docker compose up`).
3.  **Disable Signature Verification**: For load testing with dummy data, you may need to temporarily set `GITHUB_WEBHOOK_SECRET=""` or disable the signature check in `src/api/routes/webhooks.ts`.


## Running the Test (User Flows - Artillery)

Run the following command from the `backend/` directory:

```bash
artillery run tests/load/ingestion-load.yml
```

## Running the Stress Test (Resource Limits - Autocannon)

This test is designed to saturate the server's CPU and Memory limits (as defined in `compose.yml`) to verify stability under extreme load.

```bash
npm run test:stress
```

Use `docker stats` in another terminal to observe:
1.  Redis memory hitting the 100MB-128MB limit.
2.  Backend CPU usage throttling at 50%.

## Configuration Details (`ingestion-load.yml`)

-   **Phases**: Ramps up from 5 requests/sec to **50 requests/sec** over 60 seconds.
-   **Payload**: Generates random GitHub `workflow_run` IDs using `{{ $randomNumber }}` and unique delivery IDs using `{{ $uuid }}`.
-   **Expectation**: The API should return `202 Accepted` for all requests, and BullMQ should handle the background processing without stalling the event loop.


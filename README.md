# GitHub Actions Monitoring MVP

A real-time monitoring system designed to provide organization-wide visibility into GitHub Actions workflows. This tool helps identify bottlenecks, track resource consumption, and monitor runner wait times in real-time.

---

## 🧪 The Experiment
This repository is a live experiment in **Advanced Agentic Coding**, combining:
1. **Antigravity**: A powerful agentic AI coding assistant.
2. **GitHub Spec Kit**: A framework for spec-first development.

### 🚫 No "Vibe Coding"
Every step in this project is discussed and planned with AI before implementation. We follow a strict cycle: **Spec → Plan → Task → Implement**. This ensures rigor, predictability, and high-quality results.

---

## 📊 Features
This GitHub App tracks the following key operational metrics:

- **Running Workflows**: Number of workflows currently in execution across the organization.
- **Queued Workflows**: Number of workflows waiting for an available runner.
- **Average Wait Time**: The average duration from workflow trigger to execution start (crucial for detecting runner shortages).
- **Total Executions**: Cumulative count of executions per workflow/repository.
- **Time Spent**: Total and average minutes consumed by workflows, enabling cost analysis.

---

## 🏗 Architecture
The system uses a fail-safe, event-driven pipeline to ensure consistency and throughput.

```mermaid
graph TD
    subgraph GitHub
        A[GitHub Webhooks]
    end

    subgraph "Backend (Fastify + BullMQ)"
        B[Ingestion API]
        C[(Redis Queue)]
        D[Worker Service]
        E[(PostgreSQL)]
    end

    subgraph "Frontend"
        F[Dashboard UI<br/><i>SvelteKit</i>]
    end

    A -->|1. Event| B
    B -->|2. Enqueue| C
    B -.->|3. 202 Ack| A
    C -->|4. Process| D
    D -->|5. Atomic Update| E
    E <-->|6. Query| F
```

### 🧬 Ingestion Flow (De-averaged)
This diagram shows how we protect the system using multi-layer shields (Validation, Security, and Idempotency) before a single byte is saved to the database.

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub
    participant API as Ingestion API
    participant Redis as Redis (Shield)
    participant DB as Postgres (Anchor)
    participant Worker as BullMQ Worker

    Note over GH, API: WEBHOOK INGESTION PHASE

    GH->>API: POST /webhooks/github
    
    rect rgb(240, 240, 240)
        Note right of API: Shield 1: JSON Schema
        API->>API: Validate Schema
        alt Invalid Schema
            API-->>GH: 400 Bad Request
        end
    end

    rect rgb(240, 240, 240)
        Note right of API: Shield 2: Security
        API->>API: Verify Signature
        alt Signature Mismatch
            API-->>GH: 401 Unauthorized
        end
    end

    rect rgb(220, 255, 220)
        Note right of API: Shield 3: Idempotency (RAM)
        API->>Redis: SET deliveryId 1 EX 24h NX
        alt Key Exists
            API-->>GH: 202 Skipped (Cached)
        end
    end

    API->>API: Log [ANALYTICS]

    rect rgb(220, 220, 255)
        Note right of API: The Anchor: Persistence
        API->>DB: INSERT WebhookEvent
        alt DB Collision (P2002)
            API-->>GH: 202 Skipped (Backup Shield)
        else Success
            API->>Redis: Add to BullMQ
            API-->>GH: 202 Accepted
        end
    end

    Note over DB, Worker: ASYNCHRONOUS PROCESSING PHASE

    Redis->>Worker: Job Available
    Worker->>DB: Fetch Payload
    Worker->>Worker: Handle Event
    
    rect rgb(255, 240, 240)
        alt Success
            Worker->>DB: Status: PROCESSED
        else Max Retries Exhausted
            Worker->>DB: Status: FAILED
        end
    end
```

---

## 🛠 Tech Stack
- **Node.js 24+** + Fastify
- **BullMQ + Redis** (Durable processing)
- **Prisma + PostgreSQL**
- **SvelteKit + Tailwind CSS**

---

## 🚀 Getting Started

### Option 1: Full Containerized Setup (Recommended)
This runs the entire stack (Database, Redis, and Backend) in Docker.
1. **Start the stack**:
   ```bash
   docker compose up -d
   ```
2. **Setup Database**:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

### Option 2: Hybrid Local Development
Use this for faster iteration on the backend code with hot-reloads.
1. **Start only the infra**:
   ```bash
   docker compose up -d db redis
   ```
2. **Install and run locally**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```

The API will be available at `http://localhost:3000`. Use `/webhooks/github` for event ingestion.

### Environment Variables

The system uses environment variables for configuration. See `.env.example` for all available options.

**Key Variables:**
- `DATABASE_URL`: PostgreSQL connection string (Supabase in production, local Docker in dev)
- `REDIS_URL`: Redis connection string
- `GITHUB_WEBHOOK_SECRET`: Secret for validating GitHub signatures (generate with `openssl rand -hex 32`)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (`development` or `production`)

---

## 🚢 Deployment

### Local Development (Default)

The project uses Docker Compose's **override convention** for seamless local development:

```bash
# Just run - automatically uses compose.yml + compose.override.yml
docker compose up -d
```

**What happens:**
- `compose.yml`: Base configuration (Redis + Backend)
- `compose.override.yml`: Adds local Postgres database
- Result: Full stack with local database

### Production Deployment (Supabase)

For production, explicitly skip the override to use external Supabase:

```bash
# 1. Create .env from .env.example
cp .env.example .env

# 2. Fill in your Supabase DATABASE_URL
# DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres?sslmode=require

# 3. Deploy with ONLY the base compose file
docker compose -f compose.yml up -d
```

**What happens:**
- Only `compose.yml` is used (no local database)
- Backend connects to Supabase via `DATABASE_URL` from `.env`
- Prisma automatically uses native driver (Supabase has built-in pooling)

> **💡 Pro Tip:** The override file is committed to Git (shared dev setup), but `.env` is gitignored (personal/production secrets).

---

## 🛡️ Security & Reliability (Defense in Depth)

The ingestion pipeline is protected by a multi-layer "Shield" architecture designed for public VPS exposure:

1. **Rate Limiting (The Door Guard)**:
   - Cut off aggressive traffic at the door with a 429 response.
   - Per-IP limiting configured via `RATE_LIMIT_MAX`.
2. **Dynamic IP Whitelisting (The Guest List)**:
   - Only allows requests from official [GitHub IP ranges](https://api.github.com/meta).
   - Fetches ranges automatically and caches them in Redis (24h TTL).
   - Returns a silent **404 Not Found** for unauthorized IPs for maximum stealth.
   - **Local DX:** Automatically bypassed when `NODE_ENV=development` for frictionless testing.
3. **Payload Size Hardening**:
   - Strict 1MB limit on the webhook route to prevent memory-exhaustion attacks.
4. **Signature Verification**:
   - Every request must be signed with a valid `GITHUB_WEBHOOK_SECRET` using HMAC-SHA256.
   - Protected against timing attacks via constant-time comparison.
5. **Contract Validation**:
   - Pre-compiled JSON Schemas (via Fastify/Ajv) ensure only perfectly formed payloads touch the database.
6. **Docker Runtime Hardening**:
   - **Read-Only Root Filesystem:** The container filesystem is immutable at runtime (`read_only: true`), preventing attackers from modifying source code or secrets.
   - **Capability Drops:** All default Linux capabilities are removed (`cap_drop: [ALL]`), preventing processes from gaining specialized system privileges.
   - **Non-Root Execution:** The application runs as a dedicated `nodejs` user (UID 1001), never as `root`.
7. **Log Redaction**:
   - Sensitive headers (`x-hub-signature-256`) and payload fields are automatically redacted in production logs.

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.
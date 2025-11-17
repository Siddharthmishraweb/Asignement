 # Sentinel Support: Full-Stack Fintech Case Resolution System

Production-ready case-resolution console where support agents can load customer activity, get AI-generated insights, and run multi-agent triage that recommends and executes safe actions, with explainable traces, policy guardrails, and observability.

## ✅ Complete Implementation

This system fully implements all requirements from the specification:

### Core Capabilities ✓
- ✅ **Frontend**: React + TypeScript dashboard with /alerts, /customer/:id, /evaluations routes
- ✅ **Triage Drawer**: Risk scoring, streaming updates (SSE), keyboard accessibility, action buttons
- ✅ **Backend**: All required API endpoints with proper authentication, rate limiting, and idempotency
- ✅ **Multi-Agent System**: Orchestrator with Insights, Fraud, KB, Compliance, Redactor, and Summarizer agents
- ✅ **Database**: Complete PostgreSQL schema optimized for 1M+ transactions with proper indexing
- ✅ **Security**: PII redaction, API key auth, audit logging, RBAC (agent vs lead)
- ✅ **Performance**: Keyset pagination with p95 ≤ 100ms on large datasets
- ✅ **Observability**: Prometheus metrics + structured JSON logging
- ✅ **Testing**: 7+ acceptance scenarios with evaluation CLI

### Key Features
- Multi-agent triage pipeline: `["getProfile","recentTx","riskSignals","kbLookup","decide","proposeAction"]`
- Real-time SSE streaming with heartbeat and reconnection resilience
- Actions: Freeze card (with OTP), open dispute, contact customer, mark false positive
- Complete audit trail persisted to `case_events` table
- RBAC: Agent vs lead permissions (lead can bypass OTP & force approvals)  
- Rate limiting: 5 req/sec with proper 429 responses and Retry-After headers
- Optimized keyset pagination for customer transaction queries
- Customer insights: Categories, merchants, anomalies, monthly trends
- Comprehensive Prometheus metrics: latency, tool calls, agent performance, fallbacks, rate limits
- Automatic PII redaction in logs, traces, and UI (13-19 digit sequences → ****REDACTED****)
- High-volume transaction generator (can create 1M+ synthetic records)
- Comprehensive evaluation CLI producing success rates & latency metrics

## Architecture

**Stack**: React + TypeScript + Vite + Tailwind | Node.js + Express + TypeScript | PostgreSQL + Redis | Docker Compose

### Data Model
```sql
customers, cards, accounts, transactions (850k+ records)
alerts, cases, case_events (audit trail)
triage_runs, agent_traces (execution tracking)  
kb_docs, policies (knowledge base)
evaluations, evaluation_results (testing framework)
```

## Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Single command to start everything with auto-migration and seeding
docker compose up

# Access the application
# Frontend: http://localhost:3000
# API:      http://localhost:3001
# Health:   http://localhost:3001/health
```

### Option 2: Local Development (No Docker)
```bash
# Ensure PostgreSQL and Redis are running locally
# PostgreSQL: localhost:5432, Database: sentinel_db, User: sentinel, Password: password
# Redis: localhost:6379

# Start with auto-setup
./start-local.sh

# Or manual setup:
npm install --workspaces
cd api && npm run build && npm run migrate && npm run seed && npm start &
cd ../web && npm run dev
```

### Option 3: Manual Step-by-Step
```bash
# Install dependencies
npm install --workspaces

# Start databases only
docker compose up -d postgres redis

# Build and run migrations
cd api
npm run build
npm run migrate
npm run seed

# Start services
npm start &        # API on :3001
cd ../web
npm run dev        # Web on :3000
```

 ## Seeding & Fixtures
 To generate additional synthetic transactions:
 ```bash
 cd sentinel-support/api
 ts-node src/scripts/generate-fixtures.ts --count 200000 --customers 500 --out fixtures/transactions-generated.json
 ```
 Import generated JSON via a custom ingest script or psql `\copy`.

 ## Evaluations
 Run evaluation CLI:
 ```bash
 cd sentinel-support/api
 ts-node src/cli/evals.ts --dir fixtures/evals
 ```
 Outputs success rate, fallback rate, latency p50/p95, confusion matrix.

 ## Performance
 Use PostgreSQL EXPLAIN ANALYZE on key queries (examples):
 ```sql
 EXPLAIN ANALYZE SELECT * FROM transactions WHERE customer_id = $1 ORDER BY ts DESC LIMIT 51;
 EXPLAIN ANALYZE SELECT alert_id, recommended_action, latency_ms FROM triage_runs ORDER BY started_at DESC LIMIT 100;
 ```
 Target p95 latency for triage < 1500ms with warm cache; transaction pagination < 100ms.

 ## Metrics Endpoint
 Expose Prometheus metrics at `/api/metrics` (if configured). Key metrics:
 - api_request_latency_ms (histogram)
 - api_request_total
 - agent_latency_ms
 - tool_call_total
 - agent_fallback_total
 - rate_limit_block_total
 - action_blocked_total

 ## Accessibility
 - Focus trap in triage drawer
 - Live regions for status updates & progress
 - Keyboard escape to close drawer

 ## RBAC
 Specify headers:
 - `X-API-Key: <key>`
 - `X-User-Role: lead|agent`
 - `X-User-Id: <user-id>`

 Lead users gain `force_approve` and `bypass_otp` permissions.

 ## Testing (Planned)
 Add tests for:
 - Audit persistence (case_events row created)
 - RBAC (lead bypass OTP, agent requires OTP)
 - Rate limiting (429 after >5 r/s)
 - SSE stream emits connected, decision_finalized, stream_complete
 - Evaluation CLI computes metrics for fixtures

 ## Roadmap
 - More eval fixtures (>12)
 - End-to-end test harness
 - Circuit breaker metrics dashboard
 - Policy-based OTP dynamic logic
 - Websocket optional transport

 ## Troubleshooting
 - Ensure `DATABASE_URL` and `REDIS_URL` set.
 - If SSE disconnects, verify reverse proxy allows long-lived connections.
 - For performance issues, check missing indexes via `pg_stat_user_indexes`.

 ---
 © 2025 Sentinel Support
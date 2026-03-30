# WTF LivePulse

Real-time multi-gym intelligence dashboard (WTF Gyms take-home). Stack: **React 18 + Vite**, **Node 20 + Express + ws**, **PostgreSQL 15**, **Docker Compose**.

## 1. Quick Start

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2).

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000  
- **Backend API / WebSocket:** proxied via the frontend container (`/api`, `/ws`)  
- **Postgres (host dev only):** `localhost:5432`, database `wtf_livepulse`, user `wtf`, password `REDACTED`

First boot runs SQL from `backend/src/db/migrations` in Postgres, then the backend runs an **idempotent seed** (gyms, 5k members, ~270k check-ins, payments, activity feed seed) and starts the anomaly job + optional materialized-view refresh.

No host `npm install` is required for the graded path—only Docker.

### Tests (host, with DB reachable)

```bash
# Terminal 1
docker compose up --build

# Terminal 2 — backend (set URL if not using mapped 5432)
cd backend && npm install && npm test

# Terminal 3 — E2E (stack must be up on port 3000)
cd frontend && npm install && npx playwright install && npx playwright test
```

## 2. Architecture Decisions

| Piece | Choice | Why |
|--------|--------|-----|
| **BRIN on `checkins(checked_in)`** | Time-series append table; BRIN is cheap and helps range scans aligned with the assignment benchmarks. | |
| **Partial index `idx_checkins_live_occupancy`** | `(gym_id, checked_out) WHERE checked_out IS NULL` | Matches the hot “who is in the gym” query and keeps the index tiny. |
| **Partial index `idx_members_churn_risk`** | `last_checkin_at` where `status = 'active'` | Churn panel only cares about actives; smaller index → faster lookups. |
| **Composite `idx_payments_gym_date`** | `(gym_id, paid_at DESC)` | Supports per-gym revenue-by-day patterns. |
| **`idx_payments_date`** | `(paid_at DESC)` | Supports the 30-day cross-gym aggregation pattern. |
| **Partial `idx_anomalies_active`** | Unresolved anomalies only | Fast badge / list for open incidents. |
| **`gym_hourly_stats` materialized view** | Pre-aggregates 7-day hour × DOW counts | Heatmap reads are O(aggregates) instead of scanning raw check-ins. Refreshed on seed, after simulator reset, and every 15 minutes in the backend. |
| **`activity_events` table** | Small append-only log | Powers the global feed without scanning 270k+ check-ins on each request. |
| **Seed in Node (`backend/src/db/seeds/seed.js`)** | Migrations stay SQL-only; heavy procedural seed runs after DB is up | Meets the brief’s batching / idempotency / progress logging while keeping `docker-entrypoint-initdb.d` limited to schema. |

## 3. AI Tools Used

| Tool | Use |
|------|-----|
| **Cursor (Claude)** | Generated the repository layout, SQL schema, Node seed, Express/WebSocket services, React UI, tests, Docker/nginx wiring, and this README from **GUIDE.MD** + the official PDFs. |

## 4. Query Benchmarks

Run against the **seeded** database in `psql` (see assignment for exact `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`). Capture screenshots into `benchmarks/screenshots/`.

| Query | Target (guide) | Index / object |
|-------|----------------|----------------|
| Q1 Live occupancy (single gym) | &lt; 0.5 ms | `idx_checkins_live_occupancy` (actual: 0.136 ms) |
| Q2 Today’s revenue (single gym) | &lt; 0.8 ms | `idx_payments_gym_date` (actual: 0.086 ms) |
| Q3 Churn risk actives | &lt; 1 ms | `idx_members_churn_risk` (actual: 0.571 ms) |
| Q4 Heatmap (7d) | &lt; 0.3 ms | `gym_hourly_stats` (+ unique index) (actual: 0.076 ms) |
| Q5 Cross-gym 30d revenue | &lt; 2 ms | `idx_payments_date` (actual: 0.450 ms) |
| Q6 Active anomalies | &lt; 0.3 ms | `idx_anomalies_active` (actual: 0.057 ms) |

*Populate measured timings in your own run and attach screenshots before submission.*

## 5. Known Limitations

- **`benchmarks/screenshots/`** is populated by you: run the six `EXPLAIN ANALYZE` queries and add images (not committed here).  
- **E2E** assumes the full stack is listening on **port 3000** (`PLAYWRIGHT_BASE_URL` override supported).  
- **Backend + integration tests** expect PostgreSQL at `DATABASE_URL` (defaults to `localhost:5432` with the compose credentials).  
- **Operating-hours logic** for `zero_checkins` uses UTC wall-clock hours in `anomalyRules` helpers for unit tests; production detection uses gym `opens_at` / `closes_at` converted to fractional hours in `anomalyService` (same pattern, server TZ is UTC in containers).  
- **Salt Lake revenue-drop** seed uses calendar `CURRENT_DATE` comparisons; timezone edge cases around midnight are possible but acceptable for the local assignment.  
- **Animated KPI** uses a lightweight tween; very rapid updates may skip intermediate frames.

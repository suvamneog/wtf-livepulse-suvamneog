@/Users/suvamneog/Library/Application Support/Cursor/User/workspaceStorage/d7135b932e75037f86637b73781bb0f8/pdfs/581835e9-20e4-447e-9219-f289a0221e26/WTF_LivePulse_Data_Specification.pdf @/Users/suvamneog/Library/Application Support/Cursor/User/workspaceStorage/d7135b932e75037f86637b73781bb0f8/pdfs/6ddcff36-c428-4ba9-9bb4-1634dc6a5b8b/WTF_LivePulse_Technical_Assignment.pdf Here is the complete Cursor prompt compiled from both documents:

---

# WTF LivePulse — Full Cursor Prompt

## Project Overview

Build **WTF LivePulse**, a real-time multi-gym intelligence dashboard for WTF Gyms (India). This is a production-grade, full-stack system with live WebSocket updates, an anomaly detection engine, and a PostgreSQL-backed analytics layer. The entire system must start with a single command: `docker compose up`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 15 (Docker) |
| Backend | Node.js 20 + Express 4 + `ws` (WebSocket) |
| Frontend | React 18 + Vite + Recharts (or Chart.js/Nivo) |
| Infra | Docker Compose |
| Testing | Jest + Supertest (backend), Playwright (E2E) |

---

## Repository Structure (Required — Exact)

```
wtf-livepulse/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── src/
│   │   ├── routes/          # gyms, members, analytics, anomalies
│   │   ├── services/        # anomalyService, simulatorService, statsService
│   │   ├── db/
│   │   │   ├── migrations/  # 001_initial.sql, 002_indexes.sql, ...
│   │   │   ├── seeds/
│   │   │   └── pool.js
│   │   ├── jobs/            # anomalyDetector.js, simulator.js
│   │   ├── websocket/
│   │   └── app.js
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/           # Dashboard, Analytics, Anomalies
│   │   ├── hooks/           # useWebSocket, useGymData, useAnomalies
│   │   ├── store/           # React Context or Zustand
│   │   └── main.jsx
│   ├── tests/               # Playwright E2E
│   └── package.json
└── benchmarks/
    └── screenshots/         # EXPLAIN ANALYZE output for all 6 queries
```

---

## Docker Compose (Required — Exact)

```yaml
version: "3.9"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: wtf_livepulse
      POSTGRES_USER: wtf
      POSTGRES_HOST_AUTH_METHOD: trust
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/src/db/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wtf"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://wtf@db:5432/wtf_livepulse
      PORT: 3001
      NODE_ENV: development
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    command: node src/app.js

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**PDF note:** The technical assignment expects the backend entrypoint to **run a seed / DB readiness check on startup** (not only rely on `initdb.d`). See **Delta vs Official PDFs**.

**Hard rule**: `docker compose up` must work on a fresh machine with zero prior setup. No manual steps. No host-side `npm install`. No external dependencies.

---

## Database Schema

### `gyms`
```sql
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  opens_at TIME NOT NULL DEFAULT '06:00',
  closes_at TIME NOT NULL DEFAULT '22:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `members`
```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'quarterly', 'annual')),
  member_type TEXT NOT NULL DEFAULT 'new' CHECK (member_type IN ('new', 'renewal')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan_expires_at TIMESTAMPTZ NOT NULL,
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_churn_risk ON members (last_checkin_at) WHERE status = 'active';
CREATE INDEX idx_members_gym_id ON members (gym_id);
```

### `checkins`
```sql
CREATE TABLE checkins (
  id BIGSERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  checked_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out TIMESTAMPTZ,
  duration_min INTEGER GENERATED ALWAYS AS (
    CASE WHEN checked_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (checked_out - checked_in))/60
    ELSE NULL END
  ) STORED
);

CREATE INDEX idx_checkins_time_brin ON checkins USING BRIN (checked_in);
CREATE INDEX idx_checkins_live_occupancy ON checkins (gym_id, checked_out) WHERE checked_out IS NULL;
CREATE INDEX idx_checkins_member ON checkins (member_id, checked_in DESC);
```

### `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  plan_type TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'new' CHECK (payment_type IN ('new', 'renewal')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_payments_gym_date ON payments (gym_id, paid_at DESC);
CREATE INDEX idx_payments_date ON payments (paid_at DESC);
```

### `anomalies`
```sql
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('zero_checkins', 'capacity_breach', 'revenue_drop')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_anomalies_active ON anomalies (gym_id, detected_at DESC) WHERE resolved = FALSE;
```

### Materialized View (Required)
```sql
CREATE MATERIALIZED VIEW gym_hourly_stats AS
SELECT
  gym_id,
  EXTRACT(DOW FROM checked_in)::INTEGER AS day_of_week,
  EXTRACT(HOUR FROM checked_in)::INTEGER AS hour_of_day,
  COUNT(*) AS checkin_count
FROM checkins
WHERE checked_in >= NOW() - INTERVAL '7 days'
GROUP BY gym_id, day_of_week, hour_of_day;

CREATE UNIQUE INDEX ON gym_hourly_stats (gym_id, day_of_week, hour_of_day);
-- Refresh every 15 min: REFRESH MATERIALIZED VIEW CONCURRENTLY gym_hourly_stats;
```

---

## Seed Data — Exact Specifications

### 10 Gym Locations (Use exactly these values)

| # | Name | City | Capacity | Opens | Closes |
|---|---|---|---|---|---|
| 1 | WTF Gyms — Lajpat Nagar | New Delhi | 220 | 05:30 | 22:30 |
| 2 | WTF Gyms — Connaught Place | New Delhi | 180 | 06:00 | 22:00 |
| 3 | WTF Gyms — Bandra West | Mumbai | 300 | 05:00 | 23:00 |
| 4 | WTF Gyms — Powai | Mumbai | 250 | 05:30 | 22:30 |
| 5 | WTF Gyms — Indiranagar | Bengaluru | 200 | 05:30 | 22:00 |
| 6 | WTF Gyms — Koramangala | Bengaluru | 180 | 06:00 | 22:00 |
| 7 | WTF Gyms — Banjara Hills | Hyderabad | 160 | 06:00 | 22:00 |
| 8 | WTF Gyms — Sector 18 Noida | Noida | 140 | 06:00 | 21:30 |
| 9 | WTF Gyms — Salt Lake | Kolkata | 120 | 06:00 | 21:00 |
| 10 | WTF Gyms — Velachery | Chennai | 110 | 06:00 | 21:00 |

All statuses: `active`. Use `gen_random_uuid()` for IDs.

### 5,000 Members — Distribution

| Gym | Count | Monthly | Quarterly | Annual | Active % |
|---|---|---|---|---|---|
| Lajpat Nagar | 650 | 50% | 30% | 20% | 88% |
| Connaught Place | 550 | 40% | 40% | 20% | 85% |
| Bandra West | 750 | 40% | 40% | 20% | 90% |
| Powai | 600 | 40% | 40% | 20% | 87% |
| Indiranagar | 550 | 40% | 40% | 20% | 89% |
| Koramangala | 500 | 40% | 40% | 20% | 86% |
| Banjara Hills | 450 | 50% | 30% | 20% | 84% |
| Sector 18 Noida | 400 | 60% | 25% | 15% | 82% |
| Salt Lake | 300 | 60% | 30% | 10% | 80% |
| Velachery | 250 | 60% | 30% | 10% | 78% |

Member rules: Indian full names (e.g. Rahul Sharma, Priya Mehta), realistic emails and 10-digit Indian phone numbers. 80% `member_type = 'new'`, 20% `'renewal'`. Inactive remainder: 8% inactive, 4% frozen.

### Churn Risk Population (Mandatory)
- **150+ active members** with `last_checkin_at` 45–60 days ago → risk level HIGH
- **80+ active members** with `last_checkin_at` 60+ days ago → risk level CRITICAL
- `last_checkin_at` must match the actual latest row in `checkins` for that member

### ~270,000 Check-in Records — 90 Days

**Hourly multipliers:**
| Hour Block | Multiplier |
|---|---|
| 00:00–05:29 | 0.00× (closed) |
| 05:30–06:59 | 0.60× |
| 07:00–09:59 | **1.00× PEAK** |
| 10:00–11:59 | 0.40× |
| 12:00–13:59 | 0.30× |
| 14:00–16:59 | 0.20× |
| 17:00–20:59 | **0.90× PEAK** |
| 21:00–22:30 | 0.35× |
| 22:31–23:59 | 0.00× (closed) |

**Day-of-week multipliers:** Mon 1.00×, Tue 0.95×, Wed 0.90×, Thu 0.95×, Fri 0.85×, Sat 0.70×, Sun 0.45×

**Check-out rules:** All historical check-ins must have `checked_out = checked_in + random(45–90 min)`. Only today's pre-seeded open sessions have `checked_out = NULL`.

**Pre-seeded open check-ins (live occupancy on startup):**
- Large gyms (Bandra West, Powai): 25–35 open
- Medium gyms (Lajpat Nagar, CP, Indiranagar, Koramangala, Banjara Hills): 15–25 open
- Small gyms (Noida, Salt Lake, Velachery): 8–15 open

### Payment History

Plan pricing (exact — reviewers validate against these):
- `monthly`: ₹1,499
- `quarterly`: ₹3,999
- `annual`: ₹11,999

Every member gets one payment. Renewal members (`member_type = 'renewal'`) get two payments. `paid_at` must equal `joined_at ± 5 minutes`. No future timestamps.

### Anomaly Test Scenarios (Seed must set these up — detector inserts the records)

**Scenario A — Zero Check-ins (Velachery):** 0 open check-ins, most recent check-in row is 2h10m+ old. Detector must fire: `type='zero_checkins'`, `severity='warning'`.

**Scenario B — Capacity Breach (Bandra West, capacity=300):** Seed 275–295 open check-ins (all `checked_in` within last 90 min). Detector must fire: `type='capacity_breach'`, `severity='critical'`. Auto-resolves when occupancy drops below 85%.

**Scenario C — Revenue Drop (Salt Lake):** Last week same weekday: 8–10 payments totalling ≥ ₹15,000. Today: 0–2 payments totalling ≤ ₹3,000. Detector must fire: `type='revenue_drop'`, `severity='warning'`.

**Seed is idempotent** — use `ON CONFLICT DO NOTHING`. Use batch inserts (500–1000 rows per query). Target seed completion < 60 seconds. Print progress to stdout.

---

## Backend REST API

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/gyms` | All gyms with current occupancy + today's revenue |
| GET | `/api/gyms/:id/live` | Single gym snapshot < 5ms total |
| GET | `/api/gyms/:id/analytics` | Heatmap, revenue by plan, churn, new/renewal ratio. Param: `dateRange` (7d/30d/90d) |
| GET | `/api/anomalies` | Active anomalies. Optional params: `gym_id`, `severity` |
| PATCH | `/api/anomalies/:id/dismiss` | Sets `dismissed=true`. Returns 403 if `severity='critical'` |
| GET | `/api/analytics/cross-gym` | All gyms ranked by 30-day revenue < 2ms |
| POST | `/api/simulator/start` | Body: `{ speed: 1 | 5 | 10 }` |
| POST | `/api/simulator/stop` | Returns `{ status: 'paused' }` |
| POST | `/api/simulator/reset` | Clears open check-ins, resets to baseline |

---

## WebSocket Event Protocol

All events are JSON broadcast to all connected clients:

```js
// CHECKIN_EVENT
{ type: "CHECKIN_EVENT", gym_id, member_name, timestamp, current_occupancy, capacity_pct }

// CHECKOUT_EVENT
{ type: "CHECKOUT_EVENT", gym_id, member_name, timestamp, current_occupancy, capacity_pct }

// PAYMENT_EVENT
{ type: "PAYMENT_EVENT", gym_id, amount, plan_type, member_name, today_total }

// ANOMALY_DETECTED
{ type: "ANOMALY_DETECTED", anomaly_id, gym_id, gym_name, anomaly_type, severity, message }

// ANOMALY_RESOLVED
{ type: "ANOMALY_RESOLVED", anomaly_id, gym_id, resolved_at }
```

Use native `ws` package. No socket.io.

---

## Anomaly Detection Engine (Runs every 30 seconds)

| Type | Trigger | Severity | Auto-Resolve |
|---|---|---|---|
| `zero_checkins` | Active gym, no check-ins for 2+ hours during operating hours (6am–10pm) | WARNING | A new check-in is recorded |
| `capacity_breach` | Current occupancy > 90% of gym capacity | CRITICAL | Occupancy drops below 85% |
| `revenue_drop` | Today's revenue < 70% of same weekday last week | WARNING | Revenue recovers within 20% of last week |

- Resolved anomalies stay visible for 24h marked 'Resolved', then auto-archive
- Unread badge count updates via WebSocket
- Users can manually dismiss WARNING anomalies (confirmation required); CRITICAL cannot be dismissed

---

## Simulator Engine

- Generates check-in/check-out events every 2 seconds when running
- Follows realistic hourly patterns (morning and evening peaks)
- Writes directly to PostgreSQL — all queries reflect real data
- UI control panel: Start/Pause button, speed selector (1x/5x/10x), Reset button

---

## Frontend Requirements

- React 18, functional components only, no class components
- State: React Context or Zustand (preferred). Redux is **permitted** in the official brief but may be scored as over-engineering — see **Delta vs Official PDFs** below.
- Charts: Recharts, Chart.js, or Nivo (no D3 directly, no Google Charts)
- Styling: TailwindCSS, CSS Modules, or styled-components — **no default MUI/Bootstrap theme**
- WebSocket: native browser WebSocket API or `ws` npm package (no socket.io)
- **Dark theme required** — no white backgrounds

### UI Spec

| Element | Spec |
|---|---|
| Background | `#0D0D1A` or similar near-black |
| Cards | `#1A1A2E` |
| Accent | One bold colour (red, teal, or orange — pick one) |
| Text | `#E2E8F0` primary, `#64748B` secondary |
| Typography | Inter, Sora, or JetBrains Mono. Min 13px body. 32–48px KPI numerals |
| Live indicator | Pulsing green dot when WebSocket connected; red when disconnected |
| Number animations | Count-up animation 300–500ms on KPI changes |
| Responsive | Functional at 1280px minimum |
| Loading states | Skeleton loaders on all panels — no empty boxes, no `undefined` |
| Error states | Meaningful error messages in relevant panel, not just console.log |

### 4 Required UI Modules

1. **Live Gym Operations Dashboard** — gym selector tabs/dropdown (updates all widgets < 500ms), live occupancy counter (WebSocket, < 1s update), occupancy % with colour coding (green < 60%, yellow 60–85%, red > 85%), live revenue ticker, scrolling activity feed (last 20 events), all-gym summary bar
2. **Analytics Engine** — 7-day peak hours heatmap (from materialized view), revenue by plan type (filterable by date range), churn risk panel (45+ days inactive, HIGH/CRITICAL levels), new-vs-renewal donut chart, cross-gym revenue comparison chart
3. **Anomaly Detection Log** — table with Gym Name, Anomaly Type, Severity, Time Detected, Status; unread badge in nav; toast notifications for new anomalies; manual dismiss for warnings
4. **Simulator Controls** — Start/Pause, speed selector (1x/5x/10x), Reset button

---

## Query Performance Benchmarks (All 6 required with EXPLAIN ANALYZE screenshots)

| # | Query | Target | Index |
|---|---|---|---|
| Q1 | Live occupancy single gym: `SELECT COUNT(*) FROM checkins WHERE gym_id=$1 AND checked_out IS NULL` | < 0.5ms | `idx_checkins_live_occupancy` (partial) |
| Q2 | Today's revenue single gym: `SELECT SUM(amount) FROM payments WHERE gym_id=$1 AND paid_at >= CURRENT_DATE` | < 0.8ms | `idx_payments_gym_date` (composite) |
| Q3 | Churn risk members: `SELECT id, name, last_checkin_at FROM members WHERE status='active' AND last_checkin_at < NOW() - INTERVAL '45 days'` | < 1ms | `idx_members_churn_risk` (partial) |
| Q4 | Peak hour heatmap: `SELECT * FROM gym_hourly_stats WHERE gym_id=$1` | < 0.3ms | Materialized view unique index |
| Q5 | Cross-gym revenue: `SELECT gym_id, SUM(amount) FROM payments WHERE paid_at >= NOW() - INTERVAL '30 days' GROUP BY gym_id ORDER BY SUM DESC` | < 2ms | `idx_payments_date` |
| Q6 | Active anomalies: `SELECT * FROM anomalies WHERE resolved=FALSE ORDER BY detected_at DESC` | < 0.3ms | `idx_anomalies_active` (partial) |

**Any sequential scan on `checkins` or `payments` = automatic rejection.**
Screenshots go in `/benchmarks/screenshots/`. Run: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`

---

## Testing Requirements

### Unit Tests (Jest) — Minimum 10, all must pass
- `zero_checkins` anomaly fires correctly
- `capacity_breach` fires when occupancy > 90%
- `revenue_drop` fires when today < 70% of same day last week
- Anomalies auto-resolve when conditions clear
- Simulator generates check-ins with realistic time distribution

### Integration Tests (Jest + Supertest) — Minimum 12, all must pass, coverage report included (official rubric: aim for **≥80%** backend coverage for full credit; below 60% scores 0 on that criterion)
- `GET /api/gyms` returns 10 gyms after seed
- `GET /api/gyms/:id/live` returns all required fields
- `GET /api/anomalies` returns empty array when none exist
- `PATCH /api/anomalies/:id/dismiss` returns 403 for critical anomalies
- `POST /api/simulator/start` returns `{ status: 'running' }`
- All endpoints return correct status codes (400, 404, 403) on bad input

### E2E Tests (Playwright) — Minimum 3, headless, all must pass
- Dashboard loads and displays gym list
- Switching gym updates occupancy correctly
- Triggering check-in via simulator updates activity feed within 2 seconds

Run commands (must work without any additional config):
```bash
cd backend && npm test
cd frontend && npx playwright test
```

---

## README.md — 5 Required Sections

1. **Quick Start** — `docker compose up` only. List any prerequisites.
2. **Architecture Decisions** — Why each index type (BRIN vs B-Tree vs partial). Why the materialized view. All non-obvious choices with reasoning.
3. **AI Tools Used** — MANDATORY. List every tool (Claude, Cursor, Copilot, etc.) and exactly what each was used for. Omitting this = disqualification.
4. **Query Benchmarks** — Table of all 6 queries with measured execution times and indexes used.
5. **Known Limitations** — Honest list of anything incomplete or not working.

---

## Automatic Rejection Conditions

- Sequential scan on `checkins` or `payments` table
- No test files in repository
- `docker compose up` fails to start all three services
- WebSocket replaced with `setInterval` polling
- Default UI template with zero visual customisation
- Hardcoded DB password, API key, or credential committed to repo
- AI tool usage omitted from README when AI was clearly used

---

## Delta vs Official PDFs (Canonical Clarifications)

Use this section when the condensed guide above disagrees with or omits the **WTF LivePulse Technical Assignment** and **Data Specification** PDFs. The PDFs win.

| Topic | Official expectation |
|--------|----------------------|
| **Time & submission** | **3-hour** execution-style assignment. Submit a **private** GitHub repo named `wtf-livepulse-[your-name]`, add the reviewer as collaborator, link only (no ZIP). |
| **Backend + seed startup** | Technical assignment: backend **`command` must run a seed check on startup** (e.g. verify DB ready / idempotent seed), not only rely on Postgres `initdb.d`. Keep total seed **≤120 seconds** so the API does not start against an unfinished DB; **&lt;60s** is a good target, not a substitute for the 120s ceiling. |
| **Insert order** | Data spec: insert **all 5,000 members before any check-ins** (FK order). After bulk `checkins`, run a **single batch `UPDATE members SET last_checkin_at = (subquery max per member)`** so `last_checkin_at` always matches the latest `checkins` row. |
| **Renewal payments** | Renewal members (`member_type = 'renewal'`): **two** payments. First `paid_at` aligns with **original** `joined_at` (may be **91–180 days** ago per spec). Second `paid_at` = first + plan duration (30 / 90 / 365 days). No future `paid_at`. |
| **Revenue-drop seed (Salt Lake only)** | Data spec: **only** Salt Lake payment history may be shaped for the revenue-drop scenario — **do not** tweak other gyms’ payments for that test. |
| **Zero check-ins anomaly** | Detector should respect **per-gym `opens_at` / `closes_at`** (not only a generic 6am–10pm window) when deciding if “during operating hours” applies. |
| **Reviewer smoke checks** | Within **~60 seconds** of `docker compose up`, expect **≥3** rows in `anomalies` (detector discovers them; seed does not insert anomalies). Visually: **Bandra** ~90%+ occupancy, **Velachery** **0** open check-ins, all **10** gyms visible. |
| **Optional PDF tables** | Data spec **§5.3** lists **expected 30-day revenue min/max per gym** (for reviewer sanity checks beyond Bandra). Seed pricing must stay **₹1,499 / ₹3,999 / ₹11,999** exactly. |
| **Rubric / tests** | Full rubric includes **100 points**, pass **65+**, and **automatic rejection** rules overlapping this guide’s list — re-read PDF **§12** before submit. E2E rubric stresses **at least one** test that drives a check-in and asserts UI update; the guide’s 3 E2E cases satisfy that if one covers the simulator path. |

---

## Post-Seed Validation Queries (Run these yourself before submitting)

```sql
SELECT COUNT(*) FROM gyms;                          -- Must be exactly 10
SELECT COUNT(*) FROM members;                       -- Must be exactly 5,000
SELECT COUNT(*) FROM members WHERE status='active'; -- Must be 4,100–4,400
SELECT COUNT(*) FROM checkins;                      -- Must be 250,000–300,000
SELECT COUNT(*) FROM checkins WHERE checked_out IS NULL; -- Must be 100–350
SELECT COUNT(*) FROM payments;                      -- Must be 5,000–6,000
SELECT COUNT(*) FROM members WHERE last_checkin_at < NOW() - INTERVAL '45 days' AND status='active'; -- Min 230
SELECT COUNT(*) FROM checkins WHERE gym_id=(SELECT id FROM gyms WHERE name ILIKE '%Bandra%') AND checked_out IS NULL; -- 270–300
SELECT COUNT(*) FROM checkins WHERE gym_id=(SELECT id FROM gyms WHERE name ILIKE '%Velachery%') AND checked_out IS NULL; -- Must be 0
SELECT SUM(amount) FROM payments WHERE gym_id=(SELECT id FROM gyms WHERE name ILIKE '%Bandra%') AND paid_at >= NOW() - INTERVAL '30 days'; -- ₹3,50,000–₹5,50,000
```

Also run `docker compose down -v && docker compose up` to test a true cold start before submitting. 
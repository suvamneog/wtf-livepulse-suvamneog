/**
 * Requires PostgreSQL reachable at DATABASE_URL (default localhost from .env.example).
 * Idempotent seed runs in beforeAll when backend tables exist.
 */
import request from "supertest";
import { app } from "../../src/app.js";
import { pool, waitForDb } from "../../src/db/pool.js";
import { runSeed } from "../../src/db/seeds/seed.js";
import { runAnomalyCycle } from "../../src/services/anomalyService.js";
import { jest } from "@jest/globals";

jest.setTimeout(180000);

let gymId;

beforeAll(async () => {
  await waitForDb();
  await runSeed();
  await runAnomalyCycle(() => {});
  const { rows } = await pool.query(
    `SELECT id FROM gyms ORDER BY name LIMIT 1`
  );
  gymId = rows[0]?.id;
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/gyms", () => {
  test("returns 10 gyms with stats shape", async () => {
    const res = await request(app).get("/api/gyms");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(10);
    expect(res.body[0]).toHaveProperty("current_occupancy");
    expect(res.body[0]).toHaveProperty("today_revenue");
  });
});

describe("GET /api/gyms/:id/live", () => {
  test("returns snapshot fields", async () => {
    const res = await request(app).get(`/api/gyms/${gymId}/live`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("occupancy");
    expect(res.body).toHaveProperty("capacity_pct");
    expect(res.body).toHaveProperty("today_revenue");
    expect(res.body).toHaveProperty("recent_events");
    expect(res.body).toHaveProperty("active_anomalies");
  });

  test("404 for unknown gym", async () => {
    const res = await request(app).get(
      "/api/gyms/00000000-0000-4000-8000-000000000099/live"
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/anomalies", () => {
  test("returns array", async () => {
    const res = await request(app).get("/api/anomalies");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("PATCH /api/anomalies/:id/dismiss", () => {
  test("200 dismiss warning when present", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM anomalies WHERE severity = 'warning' AND resolved = FALSE AND dismissed = FALSE LIMIT 1`
    );
    if (!rows[0]) return;
    const res = await request(app)
      .patch(`/api/anomalies/${rows[0].id}/dismiss`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.dismissed).toBe(true);
  });

  test("403 for critical if such anomaly exists", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM anomalies WHERE severity = 'critical' AND resolved = FALSE LIMIT 1`
    );
    if (!rows[0]) return;
    const res = await request(app)
      .patch(`/api/anomalies/${rows[0].id}/dismiss`)
      .send({});
    expect(res.status).toBe(403);
  });

  test("404 for missing id", async () => {
    const res = await request(app)
      .patch("/api/anomalies/00000000-0000-4000-8000-000000000099/dismiss")
      .send({});
    expect(res.status).toBe(404);
  });
});

describe("POST /api/simulator", () => {
  test("start returns running", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "running", speed: 1 });
  });

  test("invalid speed 400", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 3 });
    expect(res.status).toBe(400);
  });

  test("stop returns paused", async () => {
    const res = await request(app).post("/api/simulator/stop").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "paused" });
  });

  test("reset returns reset", async () => {
    const res = await request(app).post("/api/simulator/reset").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "reset" });
  });
});

describe("GET /api/analytics/cross-gym", () => {
  test("returns ranked gyms", async () => {
    const res = await request(app).get("/api/analytics/cross-gym");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(10);
    expect(res.body[0]).toHaveProperty("rank");
  });
});

describe("GET /api/gyms/:id/analytics", () => {
  test("400 on bad dateRange", async () => {
    const res = await request(app).get(
      `/api/gyms/${gymId}/analytics?dateRange=bad`
    );
    expect(res.status).toBe(400);
  });

  test("200 with heatmap keys", async () => {
    const res = await request(app).get(
      `/api/gyms/${gymId}/analytics?dateRange=30d`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("heatmap");
    expect(res.body).toHaveProperty("churn_risk");
  });
});

describe("Summary & feed", () => {
  test("GET /api/gyms/summary", async () => {
    const res = await request(app).get("/api/gyms/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_checked_in");
  });

  test("GET /api/gyms/feed", async () => {
    const res = await request(app).get("/api/gyms/feed");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

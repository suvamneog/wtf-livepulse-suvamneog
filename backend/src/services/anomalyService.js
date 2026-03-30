import { pool } from "../db/pool.js";
import {
  shouldFireZeroCheckins,
  shouldFireCapacityBreach,
  shouldResolveCapacityBreach,
  shouldFireRevenueDrop,
  shouldResolveRevenueDrop,
} from "./anomalyRules.js";

function timeToHours(t) {
  if (!t) return 6;
  const s = String(t);
  const [hh, mm] = s.split(":");
  return Number(hh) + Number(mm || 0) / 60;
}

async function lastCheckinTime(gymId) {
  const { rows } = await pool.query(
    `SELECT MAX(checked_in) AS mx FROM checkins WHERE gym_id = $1`,
    [gymId]
  );
  return rows[0].mx;
}

async function occupancy(gymId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [gymId]
  );
  return rows[0].c;
}

async function todayRevenue(gymId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE gym_id = $1 AND paid_at::date = CURRENT_DATE`,
    [gymId]
  );
  return Number(rows[0].s);
}

async function sameWeekdayLastWeekRevenue(gymId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS s
     FROM payments
     WHERE gym_id = $1
       AND paid_at::date = (CURRENT_DATE - INTERVAL '7 days')`,
    [gymId]
  );
  return Number(rows[0].s);
}

async function findOpenAnomaly(gymId, type) {
  const { rows } = await pool.query(
    `SELECT id FROM anomalies WHERE gym_id = $1 AND type = $2 AND resolved = FALSE LIMIT 1`,
    [gymId, type]
  );
  return rows[0]?.id || null;
}

export async function runAnomalyCycle(broadcast) {
  const { rows: gyms } = await pool.query(
    `SELECT id, name, capacity, status, opens_at, closes_at FROM gyms`
  );
  const now = new Date();

  for (const g of gyms) {
    const openH = timeToHours(g.opens_at);
    const closeH = timeToHours(g.closes_at);
    const last = await lastCheckinTime(g.id);
    const occ = await occupancy(g.id);

    const zero = shouldFireZeroCheckins({
      gymStatus: g.status,
      lastCheckinAt: last,
      now,
      opensAtHours: openH,
      closesAtHours: closeH,
      idleHours: 2,
    });
    const existingZero = await findOpenAnomaly(g.id, "zero_checkins");
    if (zero && !existingZero) {
      const ins = await pool.query(
        `INSERT INTO anomalies (gym_id, type, severity, message)
         VALUES ($1, 'zero_checkins', 'warning', $2)
         RETURNING id, gym_id, type, severity, message, detected_at`,
        [g.id, `No check-ins for 2+ hours during operating hours at ${g.name}`]
      );
      broadcast?.("ANOMALY_DETECTED", {
        anomaly_id: ins.rows[0].id,
        gym_id: g.id,
        gym_name: g.name,
        anomaly_type: "zero_checkins",
        severity: "warning",
        message: ins.rows[0].message,
      });
    } else if (
      existingZero &&
      last &&
      now.getTime() - new Date(last).getTime() < 2 * 60 * 60 * 1000
    ) {
      await pool.query(
        `UPDATE anomalies SET resolved = TRUE, resolved_at = NOW() WHERE id = $1`,
        [existingZero]
      );
      broadcast?.("ANOMALY_RESOLVED", {
        anomaly_id: existingZero,
        gym_id: g.id,
        resolved_at: new Date().toISOString(),
      });
    }

    const breach = shouldFireCapacityBreach({ occupancy: occ, capacity: g.capacity });
    const existingBreach = await findOpenAnomaly(g.id, "capacity_breach");
    if (breach && !existingBreach) {
      const ins = await pool.query(
        `INSERT INTO anomalies (gym_id, type, severity, message)
         VALUES ($1, 'capacity_breach', 'critical', $2)
         RETURNING id, message`,
        [g.id, `Occupancy ${occ} exceeds 90% of capacity ${g.capacity} at ${g.name}`]
      );
      broadcast?.("ANOMALY_DETECTED", {
        anomaly_id: ins.rows[0].id,
        gym_id: g.id,
        gym_name: g.name,
        anomaly_type: "capacity_breach",
        severity: "critical",
        message: ins.rows[0].message,
      });
    } else if (
      existingBreach &&
      shouldResolveCapacityBreach({ occupancy: occ, capacity: g.capacity })
    ) {
      await pool.query(
        `UPDATE anomalies SET resolved = TRUE, resolved_at = NOW() WHERE id = $1`,
        [existingBreach]
      );
      broadcast?.("ANOMALY_RESOLVED", {
        anomaly_id: existingBreach,
        gym_id: g.id,
        resolved_at: new Date().toISOString(),
      });
    }

    const tRev = await todayRevenue(g.id);
    const wRev = await sameWeekdayLastWeekRevenue(g.id);
    const drop = shouldFireRevenueDrop({
      todayRevenue: tRev,
      sameWeekdayLastWeekRevenue: wRev,
    });
    const existingDrop = await findOpenAnomaly(g.id, "revenue_drop");
    if (drop && !existingDrop) {
      const ins = await pool.query(
        `INSERT INTO anomalies (gym_id, type, severity, message)
         VALUES ($1, 'revenue_drop', 'warning', $2)
         RETURNING id, message`,
        [
          g.id,
          `Today's revenue (${tRev}) is below 70% of same weekday last week (${wRev}) at ${g.name}`,
        ]
      );
      broadcast?.("ANOMALY_DETECTED", {
        anomaly_id: ins.rows[0].id,
        gym_id: g.id,
        gym_name: g.name,
        anomaly_type: "revenue_drop",
        severity: "warning",
        message: ins.rows[0].message,
      });
    } else if (
      existingDrop &&
      shouldResolveRevenueDrop({
        todayRevenue: tRev,
        sameWeekdayLastWeekRevenue: wRev,
      })
    ) {
      await pool.query(
        `UPDATE anomalies SET resolved = TRUE, resolved_at = NOW() WHERE id = $1`,
        [existingDrop]
      );
      broadcast?.("ANOMALY_RESOLVED", {
        anomaly_id: existingDrop,
        gym_id: g.id,
        resolved_at: new Date().toISOString(),
      });
    }
  }

  await pool.query(
    `UPDATE anomalies SET archived = TRUE
     WHERE resolved = TRUE AND resolved_at IS NOT NULL
       AND resolved_at < NOW() - INTERVAL '24 hours'
       AND archived = FALSE`
  );
}

export async function listAnomalies({ gym_id, severity } = {}) {
  let q = `
    SELECT a.id, a.gym_id, g.name AS gym_name, a.type, a.severity, a.message,
           a.resolved, a.dismissed, a.detected_at, a.resolved_at
    FROM anomalies a
    JOIN gyms g ON g.id = a.gym_id
    WHERE a.archived = FALSE
      AND (a.resolved = FALSE OR (a.resolved = TRUE AND a.resolved_at > NOW() - INTERVAL '24 hours'))
  `;
  const p = [];
  if (gym_id) {
    p.push(gym_id);
    q += ` AND a.gym_id = $${p.length}`;
  }
  if (severity) {
    p.push(severity);
    q += ` AND a.severity = $${p.length}`;
  }
  q += ` ORDER BY a.detected_at DESC`;
  const { rows } = await pool.query(q, p);
  return rows;
}

export async function dismissAnomaly(id) {
  const { rows } = await pool.query(
    `SELECT id, severity, dismissed FROM anomalies WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return { error: "not_found" };
  if (rows[0].severity === "critical") return { error: "forbidden" };
  await pool.query(
    `UPDATE anomalies SET dismissed = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  const full = await pool.query(`SELECT * FROM anomalies WHERE id = $1`, [id]);
  return { row: full.rows[0] };
}

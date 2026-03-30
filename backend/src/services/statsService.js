import { pool } from "../db/pool.js";

export async function listGymsWithStats() {
  const { rows } = await pool.query(`
    SELECT g.id, g.name, g.city, g.capacity, g.status, g.opens_at, g.closes_at,
      (SELECT COUNT(*)::int FROM checkins c WHERE c.gym_id = g.id AND c.checked_out IS NULL) AS current_occupancy,
      (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.gym_id = g.id AND p.paid_at >= CURRENT_DATE) AS today_revenue
    FROM gyms g
    ORDER BY g.name
  `);
  return rows;
}

export async function liveSnapshot(gymId) {
  const gymRes = await pool.query(
    `SELECT id, name, city, capacity, status, opens_at, closes_at FROM gyms WHERE id = $1`,
    [gymId]
  );
  if (!gymRes.rows[0]) return null;
  const g = gymRes.rows[0];
  const occRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [gymId]
  );
  const occ = occRes.rows[0].c;
  const revRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE`,
    [gymId]
  );
  const today_revenue = Number(revRes.rows[0].s);
  const anomalies = await pool.query(
    `SELECT id, type, severity, message, resolved, dismissed, detected_at
     FROM anomalies
     WHERE gym_id = $1 AND archived = FALSE AND resolved = FALSE
     ORDER BY detected_at DESC`,
    [gymId]
  );
  const events = await pool.query(
    `SELECT event_type, member_name, amount, plan_type, created_at
     FROM activity_events
     WHERE gym_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [gymId]
  );
  return {
    gym: g,
    occupancy: occ,
    capacity_pct: Math.round((occ / g.capacity) * 1000) / 10,
    today_revenue,
    active_anomalies: anomalies.rows,
    recent_events: events.rows,
  };
}

function intervalForRange(dateRange) {
  if (dateRange === "90d") return "90 days";
  if (dateRange === "30d") return "30 days";
  return "7 days";
}

export async function analyticsForGym(gymId, dateRange = "7d") {
  const iv = intervalForRange(dateRange);
  const heatmap = await pool.query(
    `SELECT day_of_week, hour_of_day, checkin_count FROM gym_hourly_stats WHERE gym_id = $1`,
    [gymId]
  );
  const revenueByPlan = await pool.query(
    `SELECT plan_type, COALESCE(SUM(amount),0) AS total
     FROM payments
     WHERE gym_id = $1 AND paid_at >= NOW() - $2::interval
     GROUP BY plan_type`,
    [gymId, iv]
  );
  const churn = await pool.query(
    `SELECT id, name, last_checkin_at,
       CASE
         WHEN last_checkin_at < NOW() - INTERVAL '60 days' THEN 'CRITICAL'
         ELSE 'HIGH'
       END AS risk_level
     FROM members
     WHERE gym_id = $1 AND status = 'active' AND last_checkin_at < NOW() - INTERVAL '45 days'
     ORDER BY last_checkin_at ASC
     LIMIT 200`,
    [gymId]
  );
  const ratio = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE payment_type = 'new')::float AS new_cnt,
       COUNT(*) FILTER (WHERE payment_type = 'renewal')::float AS ren_cnt
     FROM payments
     WHERE gym_id = $1 AND paid_at >= NOW() - INTERVAL '30 days'`,
    [gymId]
  );
  const r = ratio.rows[0];
  const total = Number(r.new_cnt) + Number(r.ren_cnt);
  const new_pct = total ? Math.round((Number(r.new_cnt) / total) * 1000) / 10 : 0;
  const renewal_pct = total ? Math.round((Number(r.ren_cnt) / total) * 1000) / 10 : 0;
  return {
    heatmap: heatmap.rows,
    revenue_by_plan: revenueByPlan.rows,
    churn_risk: churn.rows,
    new_vs_renewal: { new_pct, renewal_pct },
  };
}

export async function crossGymRevenue() {
  const { rows } = await pool.query(`
    SELECT g.id AS gym_id, g.name AS gym_name, COALESCE(SUM(p.amount), 0) AS total_revenue
    FROM gyms g
    LEFT JOIN payments p ON p.gym_id = g.id AND p.paid_at >= NOW() - INTERVAL '30 days'
    GROUP BY g.id, g.name
    ORDER BY total_revenue DESC
  `);
  return rows.map((r, i) => ({
    ...r,
    total_revenue: Number(r.total_revenue),
    rank: i + 1,
  }));
}

export async function globalSummary() {
  const occ = await pool.query(
    `SELECT COUNT(*)::int AS c FROM checkins WHERE checked_out IS NULL`
  );
  const rev = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE paid_at >= CURRENT_DATE`
  );
  const anom = await pool.query(
    `SELECT COUNT(*)::int AS c FROM anomalies WHERE resolved = FALSE AND archived = FALSE`
  );
  return {
    total_checked_in: occ.rows[0].c,
    total_today_revenue: Number(rev.rows[0].s),
    active_anomalies: anom.rows[0].c,
  };
}

export async function activityFeed(limit = 20) {
  const { rows } = await pool.query(
    `SELECT ae.event_type, ae.member_name, ae.amount, ae.plan_type, ae.created_at, g.name AS gym_name
     FROM activity_events ae
     JOIN gyms g ON g.id = ae.gym_id
     ORDER BY ae.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

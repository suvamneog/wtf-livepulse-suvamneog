import { pool } from "../db/pool.js";
import { hourMultiplier, PLAN_AMOUNTS } from "../db/seeds/gymSpec.js";

let timer = null;
let speed = 1;
let running = false;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function logActivity(event_type, gym_id, member_name, amount, plan_type) {
  await pool.query(
    `INSERT INTO activity_events (event_type, gym_id, member_name, amount, plan_type)
     VALUES ($1,$2,$3,$4,$5)`,
    [event_type, gym_id, member_name, amount, plan_type]
  );
}

async function pickWeightedGym() {
  const { rows } = await pool.query(`SELECT id FROM gyms`);
  if (!rows.length) return null;
  const now = new Date();
  const h =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const w = hourMultiplier(h) || 0.1;
  const weights = rows.map(() => w * (0.5 + Math.random()));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < rows.length; i++) {
    r -= weights[i];
    if (r <= 0) return rows[i].id;
  }
  return rows[rows.length - 1].id;
}

async function tick(broadcast) {
  const gymId = await pickWeightedGym();
  if (!gymId) return;
  const openRes = await pool.query(
    `SELECT c.id, c.member_id, m.name
     FROM checkins c
     JOIN members m ON m.id = c.member_id
     WHERE c.gym_id = $1 AND c.checked_out IS NULL
     ORDER BY random()
     LIMIT 1`,
    [gymId]
  );
  const { rows: capRow } = await pool.query(
    `SELECT capacity FROM gyms WHERE id = $1`,
    [gymId]
  );
  const capacity = capRow[0]?.capacity || 1;

  if (openRes.rows.length && Math.random() < 0.45) {
    const row = openRes.rows[0];
    await pool.query(
      `UPDATE checkins SET checked_out = NOW() WHERE id = $1`,
      [row.id]
    );
    const occRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
      [gymId]
    );
    const occ = occRes.rows[0].c;
    await logActivity("CHECKOUT", gymId, row.name, null, null);
    broadcast("CHECKOUT_EVENT", {
      type: "CHECKOUT_EVENT",
      gym_id: gymId,
      member_name: row.name,
      timestamp: new Date().toISOString(),
      current_occupancy: occ,
      capacity_pct: Math.round((occ / capacity) * 1000) / 10,
    });
    return;
  }

  const memRes = await pool.query(
    `SELECT m.id, m.name FROM members m
     WHERE m.gym_id = $1 AND m.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM checkins c WHERE c.member_id = m.id AND c.checked_out IS NULL
       )
     ORDER BY random()
     LIMIT 1`,
    [gymId]
  );
  if (!memRes.rows[0]) return;
  const m = memRes.rows[0];
  await pool.query(
    `INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
     VALUES ($1, $2, NOW(), NULL)`,
    [m.id, gymId]
  );
  await pool.query(
    `UPDATE members SET last_checkin_at = NOW() WHERE id = $1`,
    [m.id]
  );
  const occRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [gymId]
  );
  const occ = occRes.rows[0].c;
  await logActivity("CHECKIN", gymId, m.name, null, null);
  broadcast("CHECKIN_EVENT", {
    type: "CHECKIN_EVENT",
    gym_id: gymId,
    member_name: m.name,
    timestamp: new Date().toISOString(),
    current_occupancy: occ,
    capacity_pct: Math.round((occ / capacity) * 1000) / 10,
  });

  if (Math.random() < 0.06) {
    const pay = await pool.query(
      `SELECT m.id, m.name, m.plan_type FROM members m
       WHERE m.gym_id = $1 AND m.status = 'active' ORDER BY random() LIMIT 1`,
      [gymId]
    );
    const row = pay.rows[0];
    if (row) {
      const amount = PLAN_AMOUNTS[row.plan_type] || 1499;
      await pool.query(
        `INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at)
         VALUES ($1,$2,$3,$4,'new',NOW())`,
        [row.id, gymId, amount, row.plan_type]
      );
      const tot = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE`,
        [gymId]
      );
      await logActivity("PAYMENT", gymId, row.name, amount, row.plan_type);
      broadcast("PAYMENT_EVENT", {
        type: "PAYMENT_EVENT",
        gym_id: gymId,
        amount,
        plan_type: row.plan_type,
        member_name: row.name,
        today_total: Number(tot.rows[0].s),
      });
    }
  }
}

export function getSimulatorState() {
  return { running, speed };
}

export function startSimulator(s, broadcast) {
  speed = s === 5 || s === 10 ? s : 1;
  running = true;
  clearTimer();
  const ms = 2000 / speed;
  timer = setInterval(() => {
    tick(broadcast).catch((e) => console.error("simulator tick", e));
  }, ms);
}

export function stopSimulator() {
  running = false;
  clearTimer();
}

export async function resetSimulator() {
  stopSimulator();
  await pool.query(`DELETE FROM checkins WHERE checked_out IS NULL`);
  await pool.query(`REFRESH MATERIALIZED VIEW gym_hourly_stats`);
}

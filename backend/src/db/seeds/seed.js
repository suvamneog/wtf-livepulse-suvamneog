import { pool } from "../pool.js";
import {
  GYM_ROWS,
  PLAN_AMOUNTS,
  DOW_MULT,
  hourMultiplier,
} from "./gymSpec.js";

const FIRST = [
  "Rahul",
  "Priya",
  "Ankit",
  "Neha",
  "Arjun",
  "Kavya",
  "Vikram",
  "Sneha",
  "Rohan",
  "Divya",
  "Aman",
  "Isha",
  "Karan",
  "Meera",
  "Sanjay",
  "Pooja",
  "Nikhil",
  "Aditi",
  "Manish",
  "Swati",
];
const LAST = [
  "Sharma",
  "Mehta",
  "Verma",
  "Gupta",
  "Patel",
  "Reddy",
  "Iyer",
  "Nair",
  "Kapoor",
  "Singh",
  "Joshi",
  "Malhotra",
  "Agarwal",
  "Chopra",
  "Bose",
  "Das",
  "Menon",
  "Rao",
  "Khan",
  "Ghosh",
];

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addMinutes(d, m) {
  return new Date(d.getTime() + m * 60 * 1000);
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Wall-clock in Asia/Kolkata approximated via offset +05:30 */
function toIstParts(d) {
  const ms = d.getTime() + 5.5 * 60 * 60 * 1000;
  const x = new Date(ms);
  return {
    dow: x.getUTCDay(),
    hour: x.getUTCHours() + x.getUTCMinutes() / 60 + x.getUTCSeconds() / 3600,
    date: startOfUtcDay(x),
  };
}

function parseTimeToHours(t) {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function randomInOpenWindow(gym, dayStartUtc, rng) {
  const openH = parseTimeToHours(gym.opens);
  const closeH = parseTimeToHours(gym.closes);
  const slots = [];
  let wsum = 0;
  for (let step = 0; step < 48; step++) {
    const hf = openH + (step * (closeH - openH)) / 48;
    if (hf >= closeH) break;
    const w = hourMultiplier(hf);
    if (w <= 0) continue;
    slots.push({ hf, w });
    wsum += w;
  }
  if (!slots.length) return null;
  let r = rng() * wsum;
  for (const s of slots) {
    r -= s.w;
    if (r <= 0) {
      const minuteFrac = (Math.random() * (closeH - openH)) / 48;
      const hourFloat = Math.min(s.hf + minuteFrac, closeH - 0.01);
      const ms =
        dayStartUtc.getTime() +
        hourFloat * 60 * 60 * 1000 -
        5.5 * 60 * 60 * 1000;
      return new Date(ms);
    }
  }
  const s = slots[slots.length - 1];
  const ms =
    dayStartUtc.getTime() +
    s.hf * 60 * 60 * 1000 -
    5.5 * 60 * 60 * 1000;
  return new Date(ms);
}

async function alreadySeeded(client) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS c FROM members"
  );
  return rows[0].c >= 5000;
}

async function insertGyms(client) {
  for (const g of GYM_ROWS) {
    await client.query(
      `INSERT INTO gyms (name, city, capacity, status, opens_at, closes_at)
       VALUES ($1, $2, $3, 'active', $4::time, $5::time)
       ON CONFLICT (name) DO NOTHING`,
      [g.name, g.city, g.capacity, g.opens, g.closes]
    );
  }
  const { rows } = await client.query(
    "SELECT id, name FROM gyms ORDER BY name"
  );
  const byName = new Map(rows.map((r) => [r.name, r.id]));
  return byName;
}

function planForIndex(i, n, pct) {
  const m = Math.round(n * pct.monthly);
  const q = Math.round(n * pct.quarterly);
  let a = n - m - q;
  if (a < 0) a = 0;
  if (i < m) return "monthly";
  if (i < m + q) return "quarterly";
  return "annual";
}

async function insertMembers(client, gymByName) {
  const members = [];
  let emailCounter = 0;
  for (const spec of GYM_ROWS) {
    const gymId = gymByName.get(spec.name);
    const n = spec.memberCount;
    const nActive = Math.floor(n * spec.activePct);
    const nInactive = Math.floor(n * 0.08);
    const nFrozen = Math.floor(n * 0.04);
    let nOther = n - nActive - nInactive - nFrozen;
    while (nOther < 0) {
      nOther++;
    }
    const statusSlots = [];
    for (let i = 0; i < nActive; i++) statusSlots.push("active");
    for (let i = 0; i < nInactive; i++) statusSlots.push("inactive");
    for (let i = 0; i < nFrozen; i++) statusSlots.push("frozen");
    for (let i = 0; i < nOther; i++) statusSlots.push("active");
    while (statusSlots.length < n) statusSlots.push("active");
    statusSlots.sort(() => Math.random() - 0.5);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; i < n; i++) {
      const status = statusSlots[i];
      const isRenewal = Math.random() < 0.2;
      const member_type = isRenewal ? "renewal" : "new";
      let joined_at;
      if (isRenewal) {
        joined_at = new Date(
          now - randInt(91, 180) * dayMs - randInt(0, 86400000)
        );
      } else if (status === "active") {
        joined_at = new Date(
          now - randInt(0, 90) * dayMs - randInt(0, 86400000)
        );
      } else {
        joined_at = new Date(
          now - randInt(91, 180) * dayMs - randInt(0, 86400000)
        );
      }
      const plan_type = planForIndex(i, n, spec.planPct);
      let addDays = 30;
      if (plan_type === "quarterly") addDays = 90;
      if (plan_type === "annual") addDays = 365;
      const plan_expires_at = new Date(
        joined_at.getTime() + addDays * dayMs
      );
      const fn = pick(FIRST);
      const ln = pick(LAST);
      const name = `${fn} ${ln}`;
      emailCounter += 1;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${emailCounter}@gmail.com`;
      const phone = `${pick(["9", "8", "7"])}${String(randInt(0, 999999999)).padStart(9, "0")}`;
      members.push({
        gym_id: gymId,
        name,
        email,
        phone,
        plan_type,
        member_type,
        status,
        joined_at,
        plan_expires_at,
        specKey: spec.key || null,
      });
    }
  }

  const BATCH = 500;
  const ids = [];
  for (let i = 0; i < members.length; i += BATCH) {
    const chunk = members.slice(i, i + BATCH);
    const cols = [
      "gym_id",
      "name",
      "email",
      "phone",
      "plan_type",
      "member_type",
      "status",
      "joined_at",
      "plan_expires_at",
    ];
    const values = [];
    const params = [];
    chunk.forEach((m, idx) => {
      const o = idx * cols.length;
      values.push(
        `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9})`
      );
      params.push(
        m.gym_id,
        m.name,
        m.email,
        m.phone,
        m.plan_type,
        m.member_type,
        m.status,
        m.joined_at.toISOString(),
        m.plan_expires_at.toISOString()
      );
    });
    const q = `INSERT INTO members (${cols.join(",")}) VALUES ${values.join(",")} RETURNING id, gym_id, member_type, status, joined_at, plan_type`;
    const res = await client.query(q, params);
    ids.push(...res.rows);
  }
  return ids;
}

async function batchInsertCheckins(client, rows) {
  const BATCH = 800;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const vals = [];
    const params = [];
    chunk.forEach((r, j) => {
      const o = j * 4;
      vals.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4})`);
      params.push(r.member_id, r.gym_id, r.checked_in, r.checked_out);
    });
    await client.query(
      `INSERT INTO checkins (member_id, gym_id, checked_in, checked_out) VALUES ${vals.join(",")}`,
      params
    );
  }
}

export async function runSeed() {
  const client = await pool.connect();
  try {
    if (await alreadySeeded(client)) {
      console.log("Seeding skipped — database already contains seed data.");
      await client.query("REFRESH MATERIALIZED VIEW gym_hourly_stats");
      return;
    }

    console.log("Seeding gyms... ");
    await client.query("BEGIN");
    const gymByName = await insertGyms(client);
    console.log("done");

    console.log("Seeding 5000 members... ");
    const memberRows = await insertMembers(client, gymByName);
    const byGym = new Map();
    for (const r of memberRows) {
      if (!byGym.has(r.gym_id)) byGym.set(r.gym_id, []);
      byGym.get(r.gym_id).push(r);
    }
    const activeMembers = memberRows.filter((m) => m.status === "active");
    activeMembers.sort(() => Math.random() - 0.5);
    const churnHigh = new Set(
      activeMembers.slice(0, 160).map((m) => m.id)
    );
    const churnCrit = new Set(
      activeMembers.slice(160, 250).map((m) => m.id)
    );

    const gymMeta = GYM_ROWS.map((g) => ({
      ...g,
      id: gymByName.get(g.name),
    }));

    const now = new Date();
    const dayMs = 86400000;
    const checkinRows = [];
    const rng = () => Math.random();

    const churnCutoffHigh = (id) => {
      const days = 45 + Math.random() * 15;
      return new Date(now.getTime() - days * dayMs);
    };
    const churnCutoffCrit = () =>
      new Date(now.getTime() - (61 + Math.random() * 20) * dayMs);

    const cutoffMap = new Map();
    for (const id of churnHigh) cutoffMap.set(id, churnCutoffHigh(id));
    for (const id of churnCrit) cutoffMap.set(id, churnCutoffCrit());

    let targetHistorical = 268000;
    let inserted = 0;
    for (let d = 89; d >= 0 && inserted < targetHistorical; d--) {
      const dayUtc = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - d
        )
      );
      for (const gym of gymMeta) {
        const parts = toIstParts(dayUtc);
        const dowM = DOW_MULT[parts.dow];
        const base = Math.floor(300 * dowM * (0.85 + Math.random() * 0.25));
        for (let k = 0; k < base && inserted < targetHistorical; k++) {
          const list = byGym.get(gym.id) || [];
          if (!list.length) continue;
          const member = pick(list);
          if (new Date(member.joined_at) > dayUtc) continue;
          const cutoff = cutoffMap.get(member.id);
          const ts = randomInOpenWindow(gym, dayUtc, rng);
          if (!ts || ts > now) continue;
          if (cutoff && ts > cutoff) continue;
          const outM = randInt(45, 90);
          const checked_out = addMinutes(ts, outM);
          if (checked_out > now) continue;
          checkinRows.push({
            member_id: member.id,
            gym_id: gym.id,
            checked_in: ts,
            checked_out,
          });
          inserted++;
        }
      }
    }

    for (const [memberId, cutoff] of cutoffMap) {
      if (!checkinRows.some((r) => r.member_id === memberId)) {
        const m = memberRows.find((x) => x.id === memberId);
        if (!m) continue;
        checkinRows.push({
          member_id: memberId,
          gym_id: m.gym_id,
          checked_in: cutoff,
          checked_out: addMinutes(cutoff, randInt(45, 90)),
        });
      }
    }

    console.log("Seeding 90 days of check-ins... ");
    await batchInsertCheckins(client, checkinRows);

    const vel = gymMeta.find((g) => g.key === "velachery");
    const band = gymMeta.find((g) => g.key === "bandra");

    await client.query(`DELETE FROM checkins WHERE checked_out IS NULL`);

    const openRows = [];
    for (const gym of gymMeta) {
      const [lo, hi] = gym.openCheckinsRange;
      const n =
        gym.key === "velachery"
          ? 0
          : gym.key === "bandra"
            ? randInt(lo, hi)
            : randInt(lo, hi);
      const list = (byGym.get(gym.id) || []).filter(
        (m) => m.status === "active"
      );
      const used = new Set();
      let added = 0;
      while (added < n && list.length) {
        const member = pick(list);
        if (used.has(member.id)) continue;
        used.add(member.id);
        const minsAgo = randInt(5, 85);
        openRows.push({
          member_id: member.id,
          gym_id: gym.id,
          checked_in: addMinutes(now, -minsAgo),
          checked_out: null,
        });
        added++;
      }
    }
    await batchInsertCheckins(client, openRows);

    await client.query(
      `DELETE FROM checkins WHERE gym_id = $1 AND checked_in > NOW() - INTERVAL '4 hours'`,
      [vel.id]
    );
    const oldTs = addMinutes(now, -(150 + randInt(0, 60)));
    await client.query(
      `INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
       SELECT m.id, m.gym_id, $2::timestamptz, $3::timestamptz
       FROM members m
       WHERE m.gym_id = $1
       LIMIT 1`,
      [
        vel.id,
        oldTs.toISOString(),
        addMinutes(oldTs, randInt(45, 90)).toISOString(),
      ]
    );

    console.log("done");

    console.log("Seeding payments... ");
    const payRows = await client.query(
      `SELECT id, gym_id, member_type, joined_at, plan_type FROM members`
    );
    const salt = gymMeta.find((g) => g.key === "saltlake");
    const payments = [];
    for (const m of payRows.rows) {
      const amt = PLAN_AMOUNTS[m.plan_type];
      let p1 = new Date(m.joined_at);
      p1 = addMinutes(p1, randInt(-5, 5));
      payments.push({
        member_id: m.id,
        gym_id: m.gym_id,
        amount: amt,
        plan_type: m.plan_type,
        payment_type: "new",
        paid_at: p1,
      });
      if (m.member_type === "renewal") {
        let add = 30;
        if (m.plan_type === "quarterly") add = 90;
        if (m.plan_type === "annual") add = 365;
        const p2 = addMinutes(p1, add * 24 * 60);
        payments.push({
          member_id: m.id,
          gym_id: m.gym_id,
          amount: amt,
          plan_type: m.plan_type,
          payment_type: "renewal",
          paid_at: addMinutes(p2, randInt(-5, 5)),
        });
      }
    }

    const payBatch = 800;
    for (let i = 0; i < payments.length; i += payBatch) {
      const chunk = payments.slice(i, i + payBatch);
      const vals = [];
      const params = [];
      chunk.forEach((p, j) => {
        const o = j * 6;
        vals.push(
          `(gen_random_uuid(),$${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6})`
        );
        params.push(
          p.member_id,
          p.gym_id,
          p.amount,
          p.plan_type,
          p.payment_type,
          p.paid_at.toISOString()
        );
      });
      await client.query(
        `INSERT INTO payments (id, member_id, gym_id, amount, plan_type, payment_type, paid_at) VALUES ${vals.join(",")}`,
        params
      );
    }

    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const { rows: saltPayIds } = await client.query(
      `SELECT id FROM payments WHERE gym_id = $1 ORDER BY random() LIMIT 9`,
      [salt.id]
    );
    for (let i = 0; i < 8; i++) {
      const pt = new Date(lastWeek);
      pt.setHours(10 + i, 0, 0, 0);
      await client.query(
        `UPDATE payments SET amount = 2000, paid_at = $1::timestamptz WHERE id = $2`,
        [pt.toISOString(), saltPayIds[i].id]
      );
    }
    await client.query(
      `UPDATE payments SET amount = 1499, paid_at = NOW() - INTERVAL '2 hours' WHERE id = $1`,
      [saltPayIds[8].id]
    );

    console.log("done");

    await client.query(`
      UPDATE members m
      SET last_checkin_at = s.mx
      FROM (
        SELECT member_id, MAX(checked_in) AS mx
        FROM checkins
        GROUP BY member_id
      ) s
      WHERE m.id = s.member_id
    `);

    await client.query(`DELETE FROM activity_events`);
    await client.query(`
      INSERT INTO activity_events (event_type, gym_id, member_name, amount, plan_type, created_at)
      SELECT 'CHECKIN', c.gym_id, m.name, NULL, NULL, c.checked_in
      FROM checkins c
      JOIN members m ON m.id = c.member_id
      ORDER BY c.checked_in DESC
      LIMIT 20
    `);

    await client.query("COMMIT");
    console.log("Refreshing materialized view gym_hourly_stats... ");
    await client.query("REFRESH MATERIALIZED VIEW gym_hourly_stats");
    console.log("done");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    throw e;
  } finally {
    client.release();
  }
}

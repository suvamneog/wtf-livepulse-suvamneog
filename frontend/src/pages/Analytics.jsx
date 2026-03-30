import React, { useEffect, useState } from "react";
import { useApp } from "../store/AppContext.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#14B8A6", "#F97316", "#A855F7"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Analytics() {
  const { selectedGymId } = useApp();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [cross, setCross] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!selectedGymId) return;
    let c = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/gyms/${selectedGymId}/analytics?dateRange=${range}`
        );
        const j = await r.json();
        if (!c) setData(j);
      } catch (e) {
        if (!c) setErr(String(e));
      }
    })();
    return () => {
      c = true;
    };
  }, [selectedGymId, range]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/analytics/cross-gym");
        const j = await r.json();
        if (!c) setCross(j);
      } catch (e) {
        if (!c) setErr(String(e));
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const heatCells = () => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    if (!data?.heatmap) return g;
    for (const h of data.heatmap) {
      const d = Number(h.day_of_week);
      const hr = Number(h.hour_of_day);
      if (d >= 0 && d < 7 && hr >= 0 && hr < 24)
        g[d][hr] = Number(h.checkin_count);
    }
    const max = Math.max(1, ...g.flat());
    return { g, max };
  };

  const { g: grid, max } = heatCells();

  const pieData =
    data?.revenue_by_plan?.map((r) => ({
      name: r.plan_type,
      value: Number(r.total),
    })) || [];

  const donut = [
    { name: "new", value: data?.new_vs_renewal?.new_pct ?? 0 },
    { name: "renewal", value: data?.new_vs_renewal?.renewal_pct ?? 0 },
  ];

  return (
    <div className="space-y-8 min-w-[1280px] max-w-[1600px] mx-auto p-6">
      {err && (
        <div className="text-red-300 text-sm border border-red-500/30 rounded-lg p-2">
          {err}
        </div>
      )}
      <div className="flex gap-4 items-center">
        <label className="text-sm text-muted">Analytics window</label>
        <select
          className="bg-card border border-white/10 rounded-lg px-3 py-2"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="7d">7d</option>
          <option value="30d">30d</option>
          <option value="90d">90d</option>
        </select>
      </div>

      <div className="rounded-xl bg-card p-4 border border-white/5">
        <h3 className="text-muted text-sm mb-3">7-day peak hours (materialized view)</h3>
        {!data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-0.5 text-[10px]"
              style={{
                gridTemplateColumns: `56px repeat(24, minmax(0,1fr))`,
              }}
            >
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center text-muted">
                  {h}
                </div>
              ))}
              {DAYS.map((d, di) => (
                <React.Fragment key={d}>
                  <div className="text-muted pr-2">{d}</div>
                  {Array.from({ length: 24 }, (_, hi) => {
                    const v = grid[di][hi];
                    const op = 0.15 + (v / max) * 0.85;
                    return (
                      <div
                        key={`${di}-${hi}`}
                        title={`${d} ${hi}:00 — ${v}`}
                        className="h-5 rounded-sm bg-accent"
                        style={{ opacity: op }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card p-4 border border-white/5 h-80">
          <h3 className="text-muted text-sm mb-2">Revenue by plan ({range})</h3>
          {!data ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={pieData}>
                <XAxis dataKey="name" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip
                  contentStyle={{ background: "#1A1A2E", border: "none" }}
                />
                <Bar dataKey="value" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl bg-card p-4 border border-white/5 h-80">
          <h3 className="text-muted text-sm mb-2">New vs renewal (30d)</h3>
          {!data ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {donut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{ background: "#1A1A2E", border: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 border border-white/5">
        <h3 className="text-muted text-sm mb-2">Churn risk (45+ days)</h3>
        {!data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-auto max-h-64 text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted border-b border-white/10">
                  <th className="py-2">Member</th>
                  <th>Last check-in</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.churn_risk?.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-1">{r.name}</td>
                    <td className="text-muted">
                      {r.last_checkin_at
                        ? new Date(r.last_checkin_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td
                      className={
                        r.risk_level === "CRITICAL"
                          ? "text-red-400"
                          : "text-amber-300"
                      }
                    >
                      {r.risk_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-card p-4 border border-white/5 h-96">
        <h3 className="text-muted text-sm mb-2">Cross-gym revenue (30d)</h3>
        {cross.length === 0 ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={cross.map((r) => ({
                name: r.gym_name.slice(0, 14),
                revenue: Number(r.total_revenue),
              }))}
              layout="vertical"
            >
              <XAxis type="number" stroke="#64748B" />
              <YAxis dataKey="name" type="category" width={120} stroke="#64748B" />
              <Tooltip
                contentStyle={{ background: "#1A1A2E", border: "none" }}
              />
              <Bar dataKey="revenue" fill="#F97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

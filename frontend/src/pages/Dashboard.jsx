import { useApp } from "../store/AppContext.jsx";
import { AnimatedNumber } from "../components/AnimatedNumber.jsx";
import { Skeleton } from "../components/Skeleton.jsx";

function occColor(pct) {
  if (pct < 60) return "text-emerald-400";
  if (pct <= 85) return "text-amber-400";
  return "text-red-400";
}

export function Dashboard({
  onStartSim,
  onStopSim,
  onResetSim,
  simSpeed,
  setSimSpeed,
}) {
  const {
    gyms,
    selectedGymId,
    setSelectedGymId,
    live,
    feed,
    summary,
    wsConnected,
    error,
  } = useApp();

  const sel = gyms.find((g) => g.id === selectedGymId);
  const occ = sel?.current_occupancy ?? live?.occupancy ?? 0;
  const cap = sel?.capacity || 1;
  const pct = live?.capacity_pct ?? Math.round((occ / cap) * 1000) / 10;
  const rev = sel?.today_revenue ?? live?.today_revenue ?? 0;

  return (
    <div className="space-y-6 min-w-[1280px] max-w-[1600px] mx-auto p-6">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-card px-4 py-3 border border-white/5">
        <span className="text-muted text-sm">All gyms</span>
        {summary ? (
          <>
            <span className="text-sm">
              Checked in:{" "}
              <strong className="text-ink font-mono">
                {summary.total_checked_in}
              </strong>
            </span>
            <span className="text-sm">
              Today revenue:{" "}
              <strong className="text-ink font-mono">
                ₹{Math.round(summary.total_today_revenue)}
              </strong>
            </span>
            <span className="text-sm">
              Active anomalies:{" "}
              <strong className="text-accent font-mono">
                {summary.active_anomalies}
              </strong>
            </span>
          </>
        ) : (
          <Skeleton className="h-6 w-64" />
        )}
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span
            className={`h-2.5 w-2.5 rounded-full ${wsConnected ? "bg-emerald-400 live-dot" : "bg-red-500"}`}
          />
          {wsConnected ? "Live" : "Offline"}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-muted block w-full">Gym</label>
        <select
          data-testid="gym-select"
          className="bg-card border border-white/10 rounded-lg px-3 py-2 min-w-[280px]"
          value={selectedGymId || ""}
          onChange={(e) => setSelectedGymId(e.target.value)}
        >
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card p-6 border border-white/5">
          <h3 className="text-muted text-sm mb-2">Occupancy</h3>
          {sel ? (
            <>
              <div
                className={`text-5xl font-bold ${occColor(pct)} transition-colors duration-300`}
              >
                <AnimatedNumber value={occ} />{" "}
                <span className="text-xl text-muted">/ {cap}</span>
              </div>
              <div className={`text-2xl mt-2 ${occColor(pct)}`}>
                {pct}%
              </div>
            </>
          ) : (
            <Skeleton className="h-16 w-48" />
          )}
        </div>
        <div className="rounded-xl bg-card p-6 border border-white/5">
          <h3 className="text-muted text-sm mb-2">Today&apos;s revenue</h3>
          {sel ? (
            <div className="text-5xl font-bold text-accent font-mono transition-all duration-300">
              ₹<AnimatedNumber value={Number(rev)} />
            </div>
          ) : (
            <Skeleton className="h-16 w-48" />
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 border border-white/5">
        <h3 className="text-muted text-sm mb-3">Activity feed</h3>
        <div
          data-testid="activity-feed"
          className="space-y-2 max-h-72 overflow-y-auto text-sm"
        >
          {feed.length === 0 && <Skeleton className="h-20 w-full" />}
          {feed.map((e, i) => (
            <div
              key={`${e.created_at}-${i}`}
              className="flex justify-between border-b border-white/5 py-2"
            >
              <span>
                <span className="text-accent">{e.event_type}</span>{" "}
                {e.member_name}{" "}
                <span className="text-muted">
                  @{" "}
                  {e.gym_name ||
                    gyms.find((x) => x.id === e.gym_id)?.name ||
                    "—"}
                </span>
              </span>
              <span className="text-muted text-xs">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 border border-white/5 space-y-3">
        <h3 className="text-muted text-sm">Simulator</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            data-testid="sim-start"
            className="rounded-lg bg-accent text-bg px-4 py-2 font-semibold"
            onClick={() => onStartSim(simSpeed)}
          >
            Start
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2"
            onClick={onStopSim}
          >
            Pause
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2"
            onClick={onResetSim}
          >
            Reset
          </button>
          <select
            className="bg-bg border border-white/10 rounded-lg px-2 py-2"
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
          >
            <option value={1}>1x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>
    </div>
  );
}

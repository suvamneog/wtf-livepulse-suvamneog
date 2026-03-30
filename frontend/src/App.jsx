import { useState } from "react";
import { useApp } from "./store/AppContext.jsx";
import { useGymData } from "./hooks/useGymData.js";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Analytics } from "./pages/Analytics.jsx";
import { Anomalies } from "./pages/Anomalies.jsx";

export default function App() {
  const [tab, setTab] = useState("dash");
  const [simSpeed, setSimSpeed] = useState(1);
  const { anomalies, toast } = useApp();
  useGymData();
  useWebSocket();

  const openCount = anomalies.filter((a) => !a.resolved && !a.dismissed).length;

  async function postSim(path, body) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-white/10 bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex flex-wrap items-center gap-4">
          <span className="font-bold text-accent tracking-tight text-lg">
            WTF LivePulse
          </span>
          <nav className="flex gap-2">
            {[
              ["dash", "Dashboard"],
              ["analytics", "Analytics"],
              ["anomalies", `Anomalies${openCount ? ` (${openCount})` : ""}`],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                data-testid={`nav-${k}`}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === k
                    ? "bg-accent text-bg font-semibold"
                    : "bg-white/5 text-muted hover:text-ink"
                }`}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {toast && (
        <div className="fixed top-16 right-6 z-50 rounded-lg border border-accent/40 bg-card px-4 py-3 shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}

      {tab === "dash" && (
        <Dashboard
          simSpeed={simSpeed}
          setSimSpeed={setSimSpeed}
          onStartSim={(sp) => postSim("/api/simulator/start", { speed: sp })}
          onStopSim={() => postSim("/api/simulator/stop")}
          onResetSim={() => postSim("/api/simulator/reset")}
        />
      )}
      {tab === "analytics" && <Analytics />}
      {tab === "anomalies" && <Anomalies />}
    </div>
  );
}

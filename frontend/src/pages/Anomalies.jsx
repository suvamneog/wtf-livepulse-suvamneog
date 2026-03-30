import { useApp } from "../store/AppContext.jsx";
import { useAnomalies } from "../hooks/useAnomalies.js";

export function Anomalies() {
  const { anomalies } = useApp();
  const { refresh } = useAnomalies();

  async function dismiss(id, severity) {
    if (severity === "critical") return;
    if (!window.confirm("Dismiss this warning anomaly?")) return;
    const r = await fetch(`/api/anomalies/${id}/dismiss`, { method: "PATCH" });
    if (r.ok) await refresh();
  }

  return (
    <div className="min-w-[1280px] max-w-[1600px] mx-auto p-6">
      <h2 className="text-lg font-semibold mb-4">Anomaly log</h2>
      <div className="rounded-xl border border-white/5 bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-muted border-b border-white/10">
            <tr>
              <th className="p-3">Gym</th>
              <th className="p-3">Type</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Detected</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a) => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="p-3">{a.gym_name}</td>
                <td className="p-3 font-mono text-xs">{a.type}</td>
                <td
                  className={`p-3 ${
                    a.severity === "critical" ? "text-red-400" : "text-amber-300"
                  }`}
                >
                  {a.severity}
                </td>
                <td className="p-3 text-muted">
                  {new Date(a.detected_at).toLocaleString()}
                </td>
                <td className="p-3">
                  {a.resolved ? "Resolved" : "Open"}
                  {a.dismissed ? " · Dismissed" : ""}
                </td>
                <td className="p-3">
                  {!a.resolved && a.severity === "warning" && !a.dismissed && (
                    <button
                      type="button"
                      className="text-accent underline text-xs"
                      onClick={() => dismiss(a.id, a.severity)}
                    >
                      Dismiss
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

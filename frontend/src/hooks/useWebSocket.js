import { useEffect, useRef } from "react";
import { useApp } from "../store/AppContext.jsx";

function wsBase() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useWebSocket() {
  const {
    setWsConnected,
    setLive,
    selectedGymId,
    setGyms,
    setSummary,
    setFeed,
    setAnomalies,
    showToast,
  } = useApp();
  const ref = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(wsBase());
    ref.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const { type } = msg;
      if (type === "CHECKIN_EVENT" || type === "CHECKOUT_EVENT") {
        setGyms((prev) =>
          prev.map((g) =>
            g.id === msg.gym_id
              ? { ...g, current_occupancy: msg.current_occupancy }
              : g
          )
        );
        setLive((prev) =>
          prev && prev.gym?.id === msg.gym_id
            ? {
                ...prev,
                occupancy: msg.current_occupancy,
                capacity_pct: msg.capacity_pct,
              }
            : prev
        );
        setFeed((prev) => {
          const row = {
            event_type: type === "CHECKIN_EVENT" ? "CHECKIN" : "CHECKOUT",
            member_name: msg.member_name,
            gym_id: msg.gym_id,
            created_at: msg.timestamp,
          };
          return [row, ...prev].slice(0, 20);
        });
        setSummary((s) =>
          s
            ? {
                ...s,
                total_checked_in:
                  type === "CHECKIN_EVENT"
                    ? s.total_checked_in + 1
                    : Math.max(0, s.total_checked_in - 1),
              }
            : s
        );
      }
      if (type === "PAYMENT_EVENT") {
        setGyms((prev) =>
          prev.map((g) =>
            g.id === msg.gym_id
              ? { ...g, today_revenue: msg.today_total }
              : g
          )
        );
        setLive((prev) =>
          prev && prev.gym?.id === msg.gym_id
            ? { ...prev, today_revenue: msg.today_total }
            : prev
        );
        setSummary((s) =>
          s
            ? {
                ...s,
                total_today_revenue:
                  Number(s.total_today_revenue) + Number(msg.amount),
              }
            : s
        );
        setFeed((prev) => {
          const row = {
            event_type: "PAYMENT",
            member_name: msg.member_name,
            gym_id: msg.gym_id,
            amount: msg.amount,
            plan_type: msg.plan_type,
            created_at: new Date().toISOString(),
          };
          return [row, ...prev].slice(0, 20);
        });
      }
      if (type === "ANOMALY_DETECTED") {
        showToast(`${msg.severity?.toUpperCase()}: ${msg.message}`);
        setAnomalies((prev) => [
          {
            id: msg.anomaly_id,
            gym_id: msg.gym_id,
            gym_name: msg.gym_name,
            type: msg.anomaly_type,
            severity: msg.severity,
            message: msg.message,
            resolved: false,
            dismissed: false,
            detected_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSummary((s) =>
          s ? { ...s, active_anomalies: s.active_anomalies + 1 } : s
        );
      }
      if (type === "ANOMALY_RESOLVED") {
        setAnomalies((prev) =>
          prev.map((a) =>
            a.id === msg.anomaly_id ? { ...a, resolved: true } : a
          )
        );
        setSummary((s) =>
          s
            ? {
                ...s,
                active_anomalies: Math.max(0, s.active_anomalies - 1),
              }
            : s
        );
      }
    };
    return () => ws.close();
  }, [
    selectedGymId,
    setWsConnected,
    setLive,
    setGyms,
    setSummary,
    setFeed,
    setAnomalies,
    showToast,
  ]);

  return ref;
}

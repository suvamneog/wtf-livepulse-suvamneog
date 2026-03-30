import { useCallback, useEffect } from "react";
import { useApp } from "../store/AppContext.jsx";

export function useAnomalies() {
  const { setAnomalies, setError } = useApp();

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/anomalies");
      const rows = await r.json();
      setAnomalies(rows);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [setAnomalies, setError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
}

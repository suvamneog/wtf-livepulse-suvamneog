import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [gyms, setGyms] = useState([]);
  const [summary, setSummary] = useState(null);
  const [feed, setFeed] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState(null);
  const [live, setLive] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [simulator, setSimulator] = useState({ running: false, speed: 1 });

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const value = useMemo(
    () => ({
      gyms,
      setGyms,
      summary,
      setSummary,
      feed,
      setFeed,
      selectedGymId,
      setSelectedGymId,
      live,
      setLive,
      anomalies,
      setAnomalies,
      wsConnected,
      setWsConnected,
      error,
      setError,
      toast,
      showToast,
      simulator,
      setSimulator,
    }),
    [
      gyms,
      summary,
      feed,
      selectedGymId,
      live,
      anomalies,
      wsConnected,
      error,
      toast,
      showToast,
      simulator,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

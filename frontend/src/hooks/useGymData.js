import { useCallback, useEffect } from "react";
import { useApp } from "../store/AppContext.jsx";

const api = (path) => fetch(path).then((r) => r.json());

export function useGymData() {
  const {
    setGyms,
    setSummary,
    setFeed,
    setLive,
    setError,
    selectedGymId,
    setSelectedGymId,
  } = useApp();

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [gList, sum, fd] = await Promise.all([
        api("/api/gyms"),
        api("/api/gyms/summary"),
        api("/api/gyms/feed"),
      ]);
      setGyms(gList);
      setSummary(sum);
      setFeed(fd);
      setSelectedGymId((prev) => prev || gList[0]?.id || null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [setGyms, setSummary, setFeed, setError, setSelectedGymId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [gList, sum, fd] = await Promise.all([
          api("/api/gyms"),
          api("/api/gyms/summary"),
          api("/api/gyms/feed"),
        ]);
        if (cancel) return;
        setGyms(gList);
        setSummary(sum);
        setFeed(fd);
        setSelectedGymId((prev) => prev || gList[0]?.id || null);
      } catch (e) {
        if (!cancel) setError(String(e.message || e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [setGyms, setSummary, setFeed, setSelectedGymId, setError]);

  useEffect(() => {
    if (!selectedGymId) return;
    let cancel = false;
    (async () => {
      try {
        const snap = await api(`/api/gyms/${selectedGymId}/live`);
        if (!cancel) setLive(snap);
      } catch (e) {
        if (!cancel) setError(String(e.message || e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedGymId, setLive, setError]);

  return { refreshAll };
}

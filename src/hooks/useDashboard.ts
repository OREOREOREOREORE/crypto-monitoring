import { useCallback, useEffect, useState } from "react";
import type { DashboardResponse } from "../types/dashboard";

interface DashboardState {
  data: DashboardResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(intervalMs: number): DashboardState {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Fetching here is the correct use of an effect: it synchronizes the
    // component with the server. State updates happen after `await`, not
    // synchronously, so the lint heuristic is a false positive.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, loading: data === null && error === null, refresh };
}

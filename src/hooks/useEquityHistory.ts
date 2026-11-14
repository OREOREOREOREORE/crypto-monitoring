import { useEffect, useRef, useState } from "react";
import type { DashboardResponse } from "../types/dashboard";

export interface EquityPoint {
  /** Seconds since the Unix epoch. */
  time: number;
  value: number;
}

/** Accumulates one equity point per market-data refresh (i.e. per unique `updated_at`). */
export function useEquityHistory(data: DashboardResponse | null): EquityPoint[] {
  const [points, setPoints] = useState<EquityPoint[]>([]);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!data || data.updated_at === lastKey.current) return;
    lastKey.current = data.updated_at;
    setPoints((prev) => [
      ...prev,
      { time: Math.floor(Date.now() / 1000), value: data.summary.total_equity },
    ]);
  }, [data]);

  return points;
}

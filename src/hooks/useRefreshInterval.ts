import { useCallback, useState } from "react";

const STORAGE_KEY = "refresh-interval-ms";
const DEFAULT_INTERVAL = 60_000;

export const REFRESH_OPTIONS: { value: number; label: string }[] = [
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "1m" },
];

export function useRefreshInterval() {
  const [interval, setIntervalMs] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return REFRESH_OPTIONS.some((o) => o.value === saved) ? saved : DEFAULT_INTERVAL;
  });

  const setRefreshInterval = useCallback((ms: number) => {
    setIntervalMs(ms);
    localStorage.setItem(STORAGE_KEY, String(ms));
  }, []);

  return { interval, setRefreshInterval, options: REFRESH_OPTIONS };
}

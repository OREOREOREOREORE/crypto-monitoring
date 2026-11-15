import { useCallback, useState } from "react";
import type { Layout } from "react-grid-layout/legacy";

const STORAGE_KEY = "dashboard-layout-v1";

const DEFAULT_LAYOUT: Layout = [
  { i: "equity", x: 0, y: 0, w: 12, h: 16, minW: 6, minH: 8 },
  { i: "exposure", x: 0, y: 16, w: 12, h: 11, minW: 6, minH: 6 },
  { i: "funding", x: 0, y: 27, w: 12, h: 2, minW: 4, minH: 1 },
  { i: "positions", x: 0, y: 31, w: 12, h: 6, minW: 6, minH: 6 },
];

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Layout;
  } catch {
    // fall through to default
  }
  return DEFAULT_LAYOUT.map((item) => ({ ...item }));
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<Layout>(loadLayout);

  const onLayoutChange = useCallback((next: Layout) => {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT.map((item) => ({ ...item })));
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { layout, onLayoutChange, resetLayout };
}

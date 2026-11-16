import { DashboardGrid } from "./components/DashboardGrid";
import { EquityChart } from "./components/EquityChart";
import { ExposurePies } from "./components/ExposurePies";
import { FundingYield } from "./components/FundingYield";
import { PositionsTable } from "./components/PositionsTable";
import { useDashboard } from "./hooks/useDashboard";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import { useEquityHistory } from "./hooks/useEquityHistory";
import { useRefreshInterval } from "./hooks/useRefreshInterval";
import { formatUpdatedAt } from "./lib/format";

export default function App() {
  const { interval, setRefreshInterval, options: refreshOptions } = useRefreshInterval();
  const { data, error, loading, refresh } = useDashboard(interval);
  const equityPoints = useEquityHistory(data);
  const { layout, onLayoutChange, resetLayout } = useDashboardLayout();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1700px] px-4 py-6">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <label className="flex items-center gap-2">
              <span>Refresh</span>
              <select
                value={interval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
              >
                {refreshOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <span>
              Last updated{" "}
              <span className="font-mono text-zinc-200">{formatUpdatedAt(data?.updated_at)}</span>
            </span>
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Reset layout
            </button>
            {error && (
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                Retry
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load market data: {error}. Showing last known data.
          </div>
        )}

        {loading && !data ? (
          <div className="py-24 text-center text-sm text-zinc-500">Loading…</div>
        ) : (
          data && (
            <DashboardGrid
              layout={layout}
              onLayoutChange={onLayoutChange}
              equity={
                <EquityChart points={equityPoints} summary={data.summary} pairs={data.pairs} />
              }
              exposure={<ExposurePies pairs={data.pairs} />}
              funding={<FundingYield pairs={data.pairs} />}
              positions={<PositionsTable positions={data.positions} />}
            />
          )
        )}
      </div>
    </div>
  );
}

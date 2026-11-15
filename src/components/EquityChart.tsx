import { useReducer, useState, type ReactNode } from "react";
import type { PairView, Summary } from "../types/dashboard";
import type { EquityPoint } from "../hooks/useEquityHistory";
import { DEFAULT_SETTINGS, useEquityChart, type ChartSettings } from "../hooks/useEquityChart";
import { compactUsd, formatPercent, formatUsd, pnlClass } from "../lib/format";
import { DragHandle } from "./DragHandle";

interface Props {
  points: EquityPoint[];
  summary: Summary;
  pairs: PairView[];
}

type ToggleKey =
  | "showPnl"
  | "showBreakEven"
  | "showSma"
  | "showHighLow"
  | "showGrid"
  | "showPriceAxis"
  | "showLastValue"
  | "showPriceLine"
  | "autoScroll"
  | "showMarkers"
  | "showUpDown";

type SettingsAction =
  | { type: "toggle"; key: ToggleKey }
  | { type: "setChartType"; value: "area" | "line" }
  | { type: "setPnlView"; value: "delta" | "cumulative" }
  | { type: "setSmaPeriod"; value: number }
  | { type: "setCrosshairMode"; value: "normal" | "magnet" };

function settingsReducer(state: ChartSettings, action: SettingsAction): ChartSettings {
  switch (action.type) {
    case "toggle":
      return { ...state, [action.key]: !state[action.key] };
    case "setChartType":
      return { ...state, chartType: action.value };
    case "setPnlView":
      return { ...state, pnlView: action.value };
    case "setSmaPeriod":
      return { ...state, smaPeriod: action.value };
    case "setCrosshairMode":
      return { ...state, crosshairMode: action.value };
  }
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass ?? "text-zinc-200"}`}>
        {value}
      </p>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function SettingToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/60">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-emerald-500" />
    </label>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-zinc-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-xs text-zinc-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatChartTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString("en-US", { hour12: false });
}

export function EquityChart({ points, summary, pairs }: Props) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const { containerRef, hover, resetView } = useEquityChart(
    points,
    summary.starting_balance,
    settings,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const values = points.map((p) => p.value);
  const high = values.length ? Math.max(...values) : null;
  const low = values.length ? Math.min(...values) : null;
  const roi =
    summary.starting_balance !== 0 ? summary.total_unrealised_pnl / summary.starting_balance : null;
  const grossExposure = pairs.reduce(
    (sum, p) => sum + (p.spot_notional ?? 0) + (p.perp_notional ?? 0),
    0,
  );

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex shrink-0 flex-col gap-4 border-b border-zinc-800 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <DragHandle />
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Total Account Equity
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums text-zinc-50">
              {formatUsd(summary.total_equity)}
            </span>
            <span className={`text-sm tabular-nums ${pnlClass(summary.total_unrealised_pnl)}`}>
              {formatUsd(summary.total_unrealised_pnl)}
            </span>
            <span className={`text-sm tabular-nums ${pnlClass(roi)}`}>
              {formatPercent(roi, 2)} ROI
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          <Stat label="Start" value={formatUsd(summary.starting_balance)} />
          <Stat label="High" value={formatUsd(high)} />
          <Stat label="Low" value={formatUsd(low)} />
          <Stat label="Net Delta" value={formatPercent(summary.net_delta_ratio, 2)} />
          <Stat
            label="Next Funding"
            value={formatUsd(summary.total_expected_funding)}
            valueClass={pnlClass(summary.total_expected_funding)}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-zinc-700">
            {(["area", "line"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => dispatch({ type: "setChartType", value: type })}
                className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  settings.chartType === type
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <ToolbarButton
            active={settings.showPnl}
            onClick={() => dispatch({ type: "toggle", key: "showPnl" })}
          >
            PnL
          </ToolbarButton>
          <ToolbarButton
            active={settings.showBreakEven}
            onClick={() => dispatch({ type: "toggle", key: "showBreakEven" })}
          >
            Break-even
          </ToolbarButton>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Reset view
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:text-zinc-100"
          >
            ⚙ Customize
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <SettingToggle
                  label="SMA overlay"
                  checked={settings.showSma}
                  onToggle={() => dispatch({ type: "toggle", key: "showSma" })}
                />
                {settings.showSma && (
                  <SelectRow
                    label="SMA period"
                    value={String(settings.smaPeriod)}
                    options={[5, 10, 20, 30].map((n) => ({ value: String(n), label: String(n) }))}
                    onChange={(v) => dispatch({ type: "setSmaPeriod", value: Number(v) })}
                  />
                )}
                <SelectRow
                  label="PnL view"
                  value={settings.pnlView}
                  options={[
                    { value: "delta", label: "Δ per minute" },
                    { value: "cumulative", label: "Cumulative" },
                  ]}
                  onChange={(v) =>
                    dispatch({ type: "setPnlView", value: v as "delta" | "cumulative" })
                  }
                />
                <SettingToggle
                  label="High / low lines"
                  checked={settings.showHighLow}
                  onToggle={() => dispatch({ type: "toggle", key: "showHighLow" })}
                />
                <SettingToggle
                  label="High/low markers"
                  checked={settings.showMarkers}
                  onToggle={() => dispatch({ type: "toggle", key: "showMarkers" })}
                />
                <SettingToggle
                  label="Grid"
                  checked={settings.showGrid}
                  onToggle={() => dispatch({ type: "toggle", key: "showGrid" })}
                />
                <SettingToggle
                  label="Price axis"
                  checked={settings.showPriceAxis}
                  onToggle={() => dispatch({ type: "toggle", key: "showPriceAxis" })}
                />
                <SettingToggle
                  label="Last value label"
                  checked={settings.showLastValue}
                  onToggle={() => dispatch({ type: "toggle", key: "showLastValue" })}
                />
                <SettingToggle
                  label="Trailing price line"
                  checked={settings.showPriceLine}
                  onToggle={() => dispatch({ type: "toggle", key: "showPriceLine" })}
                />
                <SettingToggle
                  label="Auto-scroll"
                  checked={settings.autoScroll}
                  onToggle={() => dispatch({ type: "toggle", key: "autoScroll" })}
                />
                <SettingToggle
                  label="Up/down markers"
                  checked={settings.showUpDown}
                  onToggle={() => dispatch({ type: "toggle", key: "showUpDown" })}
                />
                <SelectRow
                  label="Crosshair"
                  value={settings.crosshairMode}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "magnet", label: "Magnet" },
                  ]}
                  onChange={(v) =>
                    dispatch({ type: "setCrosshairMode", value: v as "normal" | "magnet" })
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {hover && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-2 text-xs tabular-nums">
            <p className="text-zinc-400">{formatChartTime(hover.time)}</p>
            <p className="text-zinc-100">Equity {formatUsd(hover.equity)}</p>
            {hover.pnl != null && <p className={pnlClass(hover.pnl)}>Δ {formatUsd(hover.pnl)}</p>}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        <span>Drag to pan · scroll to zoom</span>
        <span>
          Gross exposure{" "}
          <span className="tabular-nums text-zinc-300">{compactUsd(grossExposure)}</span>
        </span>
      </div>
    </section>
  );
}

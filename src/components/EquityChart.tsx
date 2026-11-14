import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PairView, Summary } from "../types/dashboard";
import type { EquityPoint } from "../hooks/useEquityHistory";
import { compactUsd, formatPercent, formatUsd, pnlClass } from "../lib/format";
import { DragHandle } from "./DragHandle";

const AREA_FILL = { topColor: "rgba(34,197,94,0.35)", bottomColor: "rgba(34,197,94,0.02)" };
const LINE_FILL = { topColor: "transparent", bottomColor: "transparent" };
const SMA_COLOR = "#60a5fa";
const HL_COLOR = "#f59e0b";

interface Props {
  points: EquityPoint[];
  summary: Summary;
  pairs: PairView[];
}

interface HoverInfo {
  time: number;
  equity: number;
  pnl: number | null;
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
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/60">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-500"
      />
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

function computeSma(
  points: EquityPoint[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < points.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += points[j].value;
    result.push({ time: points[i].time as UTCTimestamp, value: sum / period });
  }
  return result;
}

export function EquityChart({ points, summary, pairs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const pnlSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);
  const startingBalanceRef = useRef(summary.starting_balance);
  const hasFittedRef = useRef(false);

  const [chartType, setChartType] = useState<"area" | "line">("area");
  const [showPnl, setShowPnl] = useState(true);
  const [showBreakEven, setShowBreakEven] = useState(true);
  const [showSma, setShowSma] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState(10);
  const [showHighLow, setShowHighLow] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showPriceAxis, setShowPriceAxis] = useState(true);
  const [showLastValue, setShowLastValue] = useState(true);
  const [showPriceLine, setShowPriceLine] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [crosshairMode, setCrosshairMode] = useState<"normal" | "magnet">("normal");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const values = points.map((p) => p.value);
  const high = values.length ? Math.max(...values) : null;
  const low = values.length ? Math.min(...values) : null;
  const roi =
    summary.starting_balance !== 0 ? summary.total_unrealised_pnl / summary.starting_balance : null;
  const grossExposure = pairs.reduce(
    (sum, p) => sum + (p.spot_notional ?? 0) + (p.perp_notional ?? 0),
    0,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: (price: number) =>
          `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      },
      timeScale: { timeVisible: true, secondsVisible: false, shiftVisibleRangeOnNewBar: true },
      rightPriceScale: { borderColor: "#3f3f46" },
    });

    const equitySeries = chart.addSeries(AreaSeries, {
      lineColor: "#22c55e",
      ...AREA_FILL,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const pnlSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "price", precision: 2 } },
      1,
    );

    const priceLine = equitySeries.createPriceLine({
      price: startingBalanceRef.current,
      color: "#71717a",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "start",
    });

    const onCrosshair = (param: MouseEventParams) => {
      if (param.time == null) {
        setHover(null);
        return;
      }
      const seriesData = param.seriesData as unknown as Map<unknown, { value?: number }>;
      setHover({
        time: param.time as UTCTimestamp,
        equity: seriesData.get(equitySeries)?.value ?? 0,
        pnl: seriesData.get(pnlSeries)?.value ?? null,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chartRef.current = chart;
    equitySeriesRef.current = equitySeries;
    pnlSeriesRef.current = pnlSeries;
    priceLineRef.current = priceLine;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      pnlSeriesRef.current = null;
      priceLineRef.current = null;
      smaSeriesRef.current = null;
      highLineRef.current = null;
      lowLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const equitySeries = equitySeriesRef.current;
    const pnlSeries = pnlSeriesRef.current;
    if (!equitySeries || !pnlSeries || points.length === 0) return;

    equitySeries.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

    const histogram = points.slice(1).map((p, i) => {
      const delta = p.value - points[i].value;
      return {
        time: p.time as UTCTimestamp,
        value: delta,
        color: delta >= 0 ? "#22c55e" : "#ef4444",
      };
    });
    pnlSeries.setData(histogram);

    if (!hasFittedRef.current) {
      chartRef.current?.timeScale().fitContent();
      hasFittedRef.current = true;
    }
  }, [points]);

  useEffect(() => {
    const equitySeries = equitySeriesRef.current;
    if (!equitySeries || points.length === 0) return;
    const hi = Math.max(...points.map((p) => p.value));
    const lo = Math.min(...points.map((p) => p.value));

    if (!highLineRef.current) {
      highLineRef.current = equitySeries.createPriceLine({
        price: hi,
        color: HL_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: false,
        title: "high",
        lineVisible: showHighLow,
      });
      lowLineRef.current = equitySeries.createPriceLine({
        price: lo,
        color: HL_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: false,
        title: "low",
        lineVisible: showHighLow,
      });
    } else {
      highLineRef.current?.applyOptions({ price: hi, lineVisible: showHighLow });
      lowLineRef.current?.applyOptions({ price: lo, lineVisible: showHighLow });
    }
  }, [points, showHighLow]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (!showSma) {
      if (smaSeriesRef.current) {
        chart.removeSeries(smaSeriesRef.current);
        smaSeriesRef.current = null;
      }
      return;
    }

    if (!smaSeriesRef.current) {
      smaSeriesRef.current = chart.addSeries(LineSeries, {
        color: SMA_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }
    smaSeriesRef.current.setData(computeSma(points, smaPeriod));
  }, [showSma, smaPeriod, points]);

  useEffect(() => {
    equitySeriesRef.current?.applyOptions(chartType === "line" ? LINE_FILL : AREA_FILL);
  }, [chartType]);

  useEffect(() => {
    pnlSeriesRef.current?.applyOptions({ visible: showPnl });
  }, [showPnl]);

  useEffect(() => {
    priceLineRef.current?.applyOptions(
      showBreakEven
        ? { lineVisible: true, axisLabelVisible: true, title: "start" }
        : { lineVisible: false, axisLabelVisible: false, title: "" },
    );
  }, [showBreakEven]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        vertLines: { visible: showGrid },
        horzLines: { visible: showGrid },
      },
    });
  }, [showGrid]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      crosshair: {
        mode: crosshairMode === "magnet" ? CrosshairMode.Magnet : CrosshairMode.Normal,
      },
    });
  }, [crosshairMode]);

  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({ visible: showPriceAxis });
  }, [showPriceAxis]);

  useEffect(() => {
    equitySeriesRef.current?.applyOptions({ lastValueVisible: showLastValue });
  }, [showLastValue]);

  useEffect(() => {
    equitySeriesRef.current?.applyOptions({ priceLineVisible: showPriceLine });
  }, [showPriceLine]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { shiftVisibleRangeOnNewBar: autoScroll },
    });
  }, [autoScroll]);

  const resetView = () => chartRef.current?.timeScale().fitContent();

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
                onClick={() => setChartType(type)}
                className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  chartType === type
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <ToolbarButton active={showPnl} onClick={() => setShowPnl((v) => !v)}>
            PnL
          </ToolbarButton>
          <ToolbarButton active={showBreakEven} onClick={() => setShowBreakEven((v) => !v)}>
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
                <SettingToggle label="SMA overlay" checked={showSma} onChange={setShowSma} />
                {showSma && (
                  <SelectRow
                    label="SMA period"
                    value={String(smaPeriod)}
                    options={[5, 10, 20, 30].map((n) => ({ value: String(n), label: String(n) }))}
                    onChange={(v) => setSmaPeriod(Number(v))}
                  />
                )}
                <SettingToggle
                  label="High / low lines"
                  checked={showHighLow}
                  onChange={setShowHighLow}
                />
                <SettingToggle label="Grid" checked={showGrid} onChange={setShowGrid} />
                <SettingToggle
                  label="Price axis"
                  checked={showPriceAxis}
                  onChange={setShowPriceAxis}
                />
                <SettingToggle
                  label="Last value label"
                  checked={showLastValue}
                  onChange={setShowLastValue}
                />
                <SettingToggle
                  label="Trailing price line"
                  checked={showPriceLine}
                  onChange={setShowPriceLine}
                />
                <SettingToggle label="Auto-scroll" checked={autoScroll} onChange={setAutoScroll} />
                <SelectRow
                  label="Crosshair"
                  value={crosshairMode}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "magnet", label: "Magnet" },
                  ]}
                  onChange={(v) => setCrosshairMode(v as "normal" | "magnet")}
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

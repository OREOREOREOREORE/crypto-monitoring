import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  createUpDownMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { EquityPoint } from "./useEquityHistory";

export interface ChartSettings {
  chartType: "area" | "line";
  showPnl: boolean;
  pnlView: "delta" | "cumulative";
  showBreakEven: boolean;
  showSma: boolean;
  smaPeriod: number;
  showHighLow: boolean;
  showGrid: boolean;
  showPriceAxis: boolean;
  showLastValue: boolean;
  showPriceLine: boolean;
  autoScroll: boolean;
  crosshairMode: "normal" | "magnet";
  showMarkers: boolean;
  showUpDown: boolean;
}

export const DEFAULT_SETTINGS: ChartSettings = {
  chartType: "area",
  showPnl: true,
  pnlView: "delta",
  showBreakEven: true,
  showSma: false,
  smaPeriod: 10,
  showHighLow: false,
  showGrid: true,
  showPriceAxis: true,
  showLastValue: true,
  showPriceLine: true,
  autoScroll: true,
  crosshairMode: "normal",
  showMarkers: false,
  showUpDown: false,
};

export interface HoverInfo {
  time: number;
  equity: number;
  pnl: number | null;
}

interface UpDownPlugin {
  setData: (data: { time: UTCTimestamp; value: number }[]) => void;
  clearMarkers: () => void;
}

interface MarkersPlugin {
  setMarkers: (
    markers: Array<{
      time: UTCTimestamp;
      position: "aboveBar" | "belowBar" | "inBar";
      shape: "circle" | "square" | "arrowUp" | "arrowDown";
      color: string;
      text?: string;
    }>,
  ) => void;
}

const AREA_FILL = { topColor: "rgba(34,197,94,0.35)", bottomColor: "rgba(34,197,94,0.02)" };
const LINE_FILL = { topColor: "transparent", bottomColor: "transparent" };
const SMA_COLOR = "#60a5fa";
const HL_COLOR = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";

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

export function useEquityChart(
  points: EquityPoint[],
  startingBalance: number,
  settings: ChartSettings,
): {
  containerRef: RefObject<HTMLDivElement | null>;
  hover: HoverInfo | null;
  resetView: () => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const pnlHistogramRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const pnlBaselineRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const breakEvenLineRef = useRef<IPriceLine | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);
  const upDownRef = useRef<UpDownPlugin | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  const startingBalanceRef = useRef(startingBalance);
  const hasFittedRef = useRef(false);
  const pushedRef = useRef(0);
  const [hover, setHover] = useState<HoverInfo | null>(null);

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
        timeFormatter: (time: unknown) =>
          typeof time === "number"
            ? new Date(time * 1000).toLocaleTimeString("en-US", { hour12: false })
            : String(time),
      },
      timeScale: { timeVisible: true, secondsVisible: false, shiftVisibleRangeOnNewBar: true },
      rightPriceScale: { borderColor: "#3f3f46" },
    });

    const equitySeries = chart.addSeries(AreaSeries, {
      lineColor: GREEN,
      ...AREA_FILL,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const pnlHistogram = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "price", precision: 2 } },
      1,
    );

    const pnlBaseline = chart.addSeries(
      BaselineSeries,
      {
        baseValue: { type: "price", price: 0 },
        topLineColor: GREEN,
        topFillColor1: "rgba(34,197,94,0.25)",
        topFillColor2: "rgba(34,197,94,0.02)",
        bottomLineColor: RED,
        bottomFillColor1: "rgba(239,68,68,0.25)",
        bottomFillColor2: "rgba(239,68,68,0.02)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );

    const breakEvenLine = equitySeries.createPriceLine({
      price: startingBalanceRef.current,
      color: "#71717a",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "start",
    });

    const upDown = createUpDownMarkers(equitySeries, {
      positiveColor: GREEN,
      negativeColor: RED,
      updateVisibilityDuration: 5000,
    });

    const markers = createSeriesMarkers(equitySeries, []);

    const onCrosshair = (param: MouseEventParams) => {
      if (param.time == null) {
        setHover(null);
        return;
      }
      const seriesData = param.seriesData as unknown as Map<unknown, { value?: number }>;
      setHover({
        time: param.time as UTCTimestamp,
        equity: seriesData.get(equitySeries)?.value ?? 0,
        pnl: seriesData.get(pnlHistogram)?.value ?? null,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chartRef.current = chart;
    equitySeriesRef.current = equitySeries;
    pnlHistogramRef.current = pnlHistogram;
    pnlBaselineRef.current = pnlBaseline;
    breakEvenLineRef.current = breakEvenLine;
    upDownRef.current = upDown;
    markersRef.current = markers;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      pnlHistogramRef.current = null;
      pnlBaselineRef.current = null;
      breakEvenLineRef.current = null;
      smaSeriesRef.current = null;
      highLineRef.current = null;
      lowLineRef.current = null;
      upDownRef.current = null;
      markersRef.current = null;
      pushedRef.current = 0;
    };
  }, []);

  // Append new points via update() (docs-recommended real-time path).
  useEffect(() => {
    const equitySeries = equitySeriesRef.current;
    const pnlHistogram = pnlHistogramRef.current;
    const pnlBaseline = pnlBaselineRef.current;
    if (!equitySeries || !pnlHistogram || !pnlBaseline || points.length === 0) return;

    const base = startingBalanceRef.current;
    for (let i = pushedRef.current; i < points.length; i++) {
      const t = points[i].time as UTCTimestamp;
      equitySeries.update({ time: t, value: points[i].value });
      pnlBaseline.update({ time: t, value: points[i].value - base });
      if (i > 0) {
        const delta = points[i].value - points[i - 1].value;
        pnlHistogram.update({ time: t, value: delta, color: delta >= 0 ? GREEN : RED });
      }
    }
    pushedRef.current = points.length;

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
        lineVisible: settings.showHighLow,
      });
      lowLineRef.current = equitySeries.createPriceLine({
        price: lo,
        color: HL_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: false,
        title: "low",
        lineVisible: settings.showHighLow,
      });
    } else {
      highLineRef.current?.applyOptions({ price: hi });
      lowLineRef.current?.applyOptions({ price: lo });
    }

    if (!hasFittedRef.current) {
      chartRef.current?.timeScale().fitContent();
      hasFittedRef.current = true;
    }
  }, [points, settings.showHighLow]);

  // SMA overlay.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (!settings.showSma) {
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
    smaSeriesRef.current.setData(computeSma(points, settings.smaPeriod));
  }, [settings.showSma, settings.smaPeriod, points]);

  // High/low markers on the equity series.
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;

    if (!settings.showMarkers || points.length === 0) {
      markers.setMarkers([]);
      return;
    }

    let hiIdx = 0;
    let loIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].value > points[hiIdx].value) hiIdx = i;
      if (points[i].value < points[loIdx].value) loIdx = i;
    }
    markers.setMarkers([
      {
        time: points[hiIdx].time as UTCTimestamp,
        position: "aboveBar",
        shape: "arrowDown",
        color: HL_COLOR,
        text: "H",
      },
      {
        time: points[loIdx].time as UTCTimestamp,
        position: "belowBar",
        shape: "arrowUp",
        color: HL_COLOR,
        text: "L",
      },
    ]);
  }, [points, settings.showMarkers]);

  // Up/down "live tick" markers.
  useEffect(() => {
    const upDown = upDownRef.current;
    if (!upDown) return;
    if (settings.showUpDown) {
      upDown.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    } else {
      upDown.clearMarkers();
    }
  }, [points, settings.showUpDown]);

  // Apply all series/chart settings.
  useEffect(() => {
    const chart = chartRef.current;
    const equitySeries = equitySeriesRef.current;
    if (!chart || !equitySeries) return;

    equitySeries.applyOptions(settings.chartType === "line" ? LINE_FILL : AREA_FILL);
    equitySeries.applyOptions({
      lastValueVisible: settings.showLastValue,
      priceLineVisible: settings.showPriceLine,
    });
    pnlHistogramRef.current?.applyOptions({
      visible: settings.showPnl && settings.pnlView === "delta",
    });
    pnlBaselineRef.current?.applyOptions({
      visible: settings.showPnl && settings.pnlView === "cumulative",
    });
    breakEvenLineRef.current?.applyOptions(
      settings.showBreakEven
        ? { lineVisible: true, axisLabelVisible: true, title: "start" }
        : { lineVisible: false, axisLabelVisible: false, title: "" },
    );
    highLineRef.current?.applyOptions({ lineVisible: settings.showHighLow });
    lowLineRef.current?.applyOptions({ lineVisible: settings.showHighLow });
    chart.applyOptions({
      grid: {
        vertLines: { visible: settings.showGrid },
        horzLines: { visible: settings.showGrid },
      },
      crosshair: {
        mode: settings.crosshairMode === "magnet" ? CrosshairMode.Magnet : CrosshairMode.Normal,
      },
      timeScale: { shiftVisibleRangeOnNewBar: settings.autoScroll },
    });
    chart.priceScale("right").applyOptions({ visible: settings.showPriceAxis });

    const panes = chart.panes();
    if (panes.length >= 2) {
      panes[0].setStretchFactor(settings.showPnl ? 0.8 : 1);
      panes[1].setStretchFactor(settings.showPnl ? 0.2 : 0);
    }
  }, [settings]);

  const resetView = () => chartRef.current?.timeScale().fitContent();

  return { containerRef, hover, resetView };
}

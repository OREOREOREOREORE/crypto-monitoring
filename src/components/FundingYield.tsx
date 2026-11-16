import type { PairView } from "../types/dashboard";
import { Widget } from "./Widget";
import { formatPercent, pnlClass } from "../lib/format";

interface Props {
  pairs: PairView[];
}

interface Row {
  asset: string;
  apr: number;
  apy: number;
  weight: number;
}

export function FundingYield({ pairs }: Props) {
  const rows: Row[] = pairs
    .filter((p) => p.funding_apr != null)
    .map((p) => ({
      asset: p.asset,
      apr: p.funding_apr as number,
      apy: p.funding_apy as number,
      weight: p.perp_notional ?? 0,
    }));

  const maxAbs = Math.max(0.001, ...rows.map((r) => Math.abs(r.apr)));

  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  const weightedApr =
    totalWeight > 0 ? rows.reduce((sum, r) => sum + r.apr * r.weight, 0) / totalWeight : null;
  const weightedApy =
    totalWeight > 0 ? rows.reduce((sum, r) => sum + r.apy * r.weight, 0) / totalWeight : null;

  return (
    <Widget title="Funding Yield">
      <div className="flex h-full flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400">Weighted avg (annualized)</span>
          <span className="tabular-nums">
            <span className={pnlClass(weightedApr)}>{formatPercent(weightedApr, 2)}</span>
            <span className="text-zinc-600"> APR · </span>
            <span className={pnlClass(weightedApy)}>{formatPercent(weightedApy, 2)}</span>
            <span className="text-zinc-600"> APY</span>
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {rows.map((r) => {
            const positive = r.apr >= 0;
            const width = `${(Math.abs(r.apr) / maxAbs) * 50}%`;
            return (
              <div key={r.asset} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {r.asset}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-800/60">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-600" />
                  <div
                    className={`absolute top-0 h-full rounded-full ${
                      positive ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    style={positive ? { left: "50%", width } : { right: "50%", width }}
                  />
                </div>
                <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums">
                  <span className={pnlClass(r.apr)}>{formatPercent(r.apr, 2)}</span>
                  <span className="text-zinc-600"> APR · </span>
                  <span className={pnlClass(r.apy)}>{formatPercent(r.apy, 2)}</span>
                  <span className="text-zinc-600"> APY</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Widget>
  );
}

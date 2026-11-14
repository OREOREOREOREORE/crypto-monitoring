import type { PairView } from "../types/dashboard";
import { Widget } from "./Widget";
import { formatPercent, pnlClass } from "../lib/format";

interface Props {
  pairs: PairView[];
}

export function FundingApr({ pairs }: Props) {
  const rows = pairs
    .filter((p) => p.funding_apr != null)
    .map((p) => ({
      asset: p.asset,
      apr: p.funding_apr as number,
      weight: p.perp_notional ?? 0,
    }));

  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  const weightedAvg =
    totalWeight > 0 ? rows.reduce((sum, r) => sum + r.apr * r.weight, 0) / totalWeight : null;

  return (
    <Widget title="Funding APR">
      <div className="flex h-full flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400">Weighted average (annualized)</span>
          <span className={`tabular-nums ${pnlClass(weightedAvg)}`}>
            {formatPercent(weightedAvg, 2)}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((r) => (
            <div key={r.asset} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{r.asset}</p>
              <p
                className={`mt-0.5 truncate text-base font-semibold tabular-nums ${pnlClass(r.apr)}`}
              >
                {formatPercent(r.apr, 2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  );
}

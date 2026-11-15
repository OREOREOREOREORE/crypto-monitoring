import type { PositionView } from "../types/dashboard";
import { Widget } from "./Widget";
import { useNow } from "../hooks/useNow";
import { formatCountdown, formatNumber, formatPercent, formatUsd, pnlClass } from "../lib/format";

interface Props {
  positions: PositionView[];
}

function sideBadge(side: string): string {
  return side === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400";
}

function instrumentBadge(instrument: string): string {
  return instrument === "SPOT"
    ? "bg-zinc-700/40 text-zinc-300"
    : "bg-violet-500/15 text-violet-300";
}

export function PositionsTable({ positions }: Props) {
  const now = useNow();

  return (
    <Widget title="Positions">
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Instrument</th>
              <th className="px-4 py-2 font-medium">Side</th>
              <th className="px-4 py-2 text-right font-medium">Quantity</th>
              <th className="px-4 py-2 text-right font-medium">Entry Price</th>
              <th className="px-4 py-2 text-right font-medium">Current Price</th>
              <th className="px-4 py-2 text-right font-medium">Position Value</th>
              <th className="px-4 py-2 text-right font-medium">Unrealised PnL</th>
              <th className="px-4 py-2 text-right font-medium">Funding Rate</th>
              <th className="px-4 py-2 text-right font-medium">Next Funding</th>
              <th className="px-4 py-2 text-right font-medium">Expected Funding</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const isPerp = p.instrument === "PERP";
              const countdown =
                isPerp && p.next_funding_time != null ? p.next_funding_time - now : null;
              return (
                <tr key={`${p.symbol}-${p.instrument}`} className="border-t border-zinc-800/70">
                  <td className="px-4 py-2 font-mono text-zinc-200">{p.symbol}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${instrumentBadge(p.instrument)}`}
                    >
                      {p.instrument}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${sideBadge(p.side)}`}
                    >
                      {p.side}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                    {formatNumber(p.quantity)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                    {formatUsd(p.entry_price)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                    {formatUsd(p.current_price)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                    {formatUsd(p.notional)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${pnlClass(p.pnl)}`}>
                    {formatUsd(p.pnl)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                    {isPerp ? formatPercent(p.funding_rate) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-300">
                    {isPerp ? formatCountdown(countdown) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${pnlClass(p.expected_funding)}`}
                  >
                    {isPerp ? formatUsd(p.expected_funding) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Widget>
  );
}

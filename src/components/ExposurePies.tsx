import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import type { PairView } from "../types/dashboard";
import { Widget } from "./Widget";
import { compactUsd, formatUsd } from "../lib/format";

const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#14f195",
  HYPE: "#00d1ff",
};

interface Slice {
  name: string;
  value: number;
}

function PiePanel({ title, data }: { title: string; data: Slice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</h3>
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="none"
              shape={(props) => (
                <Sector {...props} fill={ASSET_COLORS[String(props.name)] ?? "#71717a"} />
              )}
            />
            <Tooltip formatter={(value) => formatUsd(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Total</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-100">
            {compactUsd(total)}
          </span>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((slice) => (
          <li key={slice.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ASSET_COLORS[slice.name] ?? "#71717a" }}
              />
              {slice.name}
            </span>
            <span className="font-medium tabular-nums text-zinc-100">{formatUsd(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExposurePies({ pairs }: { pairs: PairView[] }) {
  const spotData: Slice[] = pairs
    .filter((p) => p.spot_notional != null)
    .map((p) => ({ name: p.asset, value: p.spot_notional as number }));

  const perpData: Slice[] = pairs
    .filter((p) => p.perp_notional != null)
    .map((p) => ({ name: p.asset, value: p.perp_notional as number }));

  return (
    <Widget title="Notional Exposure">
      <div className="grid h-full grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        <PiePanel title="Spot" data={spotData} />
        <PiePanel title="Perp" data={perpData} />
      </div>
    </Widget>
  );
}

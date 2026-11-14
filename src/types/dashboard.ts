export type Instrument = "SPOT" | "PERP";
export type Side = "LONG" | "SHORT";

export interface Summary {
  total_equity: number;
  starting_balance: number;
  total_unrealised_pnl: number;
  total_expected_funding: number;
  net_delta_ratio: number;
}

export interface PositionView {
  asset: string;
  symbol: string;
  instrument: Instrument;
  side: Side;
  quantity: number;
  entry_price: number;
  current_price: number | null;
  notional: number | null;
  pnl: number | null;
  funding_rate: number | null;
  next_funding_time: number | null;
  expected_funding: number | null;
}

export interface PairView {
  asset: string;
  spot_notional: number | null;
  perp_notional: number | null;
  net_exposure: number | null;
  funding_apr: number | null;
}

export interface DashboardResponse {
  updated_at: string;
  summary: Summary;
  positions: PositionView[];
  pairs: PairView[];
}

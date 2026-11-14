# CONTEXT.md

Domain glossary for the real-time portfolio monitoring dashboard.

## Terms

- **Portfolio** — the collection of positions for one account.
- **Position** — a single holding with `asset`, `symbol`, `instrument`, `side`, `quantity`, and `entryPrice`.
- **Cash position** — a Position whose `asset` is `USDT`. Its `quantity` is the **Starting Balance**; it has no market exposure, no funding, and no PnL.
- **Leg** — a market-facing position (one side of a Pair).
- **Pair** — the two Legs of one asset (spot long + perp short).
- **Asset** — the underlying coin (`BTC`, `ETH`, `SOL`, `HYPE`, `USDT`).
- **Symbol** — the exchange ticker (`BTCUSDT`, …).
- **Instrument** — `SPOT` or `PERP`.
- **Side** — `LONG` or `SHORT`.
- **Quantity** — position size in token units.
- **Entry Price** — price at which the position was opened.
- **Current Price** — the live price; sourced from `lastPrice` for spot and `markPrice` for perp.
- **Notional** — `Quantity × Current Price`.
- **Signed Notional** — `Notional` with `Side` applied (`+` long, `−` short).
- **Net Exposure (Delta)** — per Pair, `spot Signed Notional + perp Signed Notional`.
- **PnL** — unrealised profit/loss: `sign × (Current Price − Entry Price) × Quantity`.
- **Equity** — `Starting Balance + Σ PnL` across all Legs.
- **Starting Balance** — the `USDT` Cash position's `Quantity`.
- **Funding Rate (`r`)** — the exchange's periodic funding rate.
- **Expected Funding** — `−Signed Notional × r` (positive = receive).
- **Funding APR** — `r × 3 payments/day × 365`.
- **nextFundingTime** — the timestamp of the next funding settlement.

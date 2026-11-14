# Real-Time Portfolio Monitoring — Implementation Plan

> Case study: delta-neutral funding-rate arbitrage dashboard.
> Source spec: `Student Developer - Case Study.pdf`.

## 1. Objective

Build a real-time web dashboard that monitors a delta-neutral funding-rate arbitrage
portfolio. It loads a mock portfolio (4 long spot positions hedged by 4 short perpetual
positions), pulls live market data from Bybit's public API, computes metrics, and renders
them on a dashboard that refreshes every minute.

## 2. Tech Stack

| Layer    | Choice                                                                    |
| -------- | ------------------------------------------------------------------------- |
| Backend  | Python + FastAPI (uvicorn + httpx + pydantic)                             |
| Frontend | React 19 + TypeScript + Vite (Vite+ toolchain, existing scaffold)         |
| Charts   | TradingView `lightweight-charts` (live equity line) + Recharts (two pies) |
| Styling  | Tailwind CSS                                                              |
| Tests    | pytest (backend calculation layer)                                        |

## 3. Portfolio Data

Loaded from `backend/app/portfolio.json`. **Starting balance = $50,000** (the `USDT` spot
position, which is cash: price fixed at $1, no PnL, no funding, no Bybit lookup).

| Asset | Symbol   | Instrument | Side  | Quantity | Entry   |
| ----- | -------- | ---------- | ----- | -------- | ------- |
| USDT  | USDT     | SPOT       | LONG  | 50,000   | $1.00   |
| BTC   | BTCUSDT  | SPOT       | LONG  | 1.25     | $70,000 |
| BTC   | BTCUSDT  | PERP       | SHORT | 1.25     | $70,000 |
| ETH   | ETHUSDT  | SPOT       | LONG  | 22.5     | $2,200  |
| ETH   | ETHUSDT  | PERP       | SHORT | 22.5     | $2,200  |
| SOL   | SOLUSDT  | SPOT       | LONG  | 265      | $100    |
| SOL   | SOLUSDT  | PERP       | SHORT | 265      | $100    |
| HYPE  | HYPEUSDT | SPOT       | LONG  | 244.71   | $88     |
| HYPE  | HYPEUSDT | PERP       | SHORT | 244.71   | $88     |

Four delta-neutral pairs (BTC, ETH, SOL, HYPE): each has an equal-size spot long and perp
short. Gross notional ≈ $185k per side; net delta ≈ 0.

## 4. Calculation Model

One sign convention drives everything: `sign = +1 (LONG) / −1 (SHORT)`.

- `signedNotional = sign × qty × currentPrice`
- `pnl = sign × (currentPrice − entryPrice) × qty`
- `netExposure(pair) = spotSignedNotional + perpSignedNotional` (≈ 0 when hedged)
- `fundingPayout = −signedNotional × fundingRate` → for short perps = `+notional × r`
  (receive when `r > 0`)
- `totalEquity = 50,000 + Σ pnl(8 legs)`
- `netDeltaRatio = Σ netExposure(pairs) / totalEquity`
- `fundingApr(pair) = fundingRate × 3 payments/day × 365`

Prices: perp legs use Bybit `markPrice` + `fundingRate` + `nextFundingTime`; spot legs use
`lastPrice`. USDT is hard-coded to $1.

## 5. File Structure

```
crypto-monitoring/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app, /api/dashboard, startup poll task
│   │   ├── calculations.py    # pure functions (section 4)
│   │   ├── market_data.py     # httpx Bybit client + 60s in-memory cache
│   │   ├── portfolio.py       # load portfolio.json → typed positions
│   │   ├── models.py          # pydantic response schemas
│   │   └── portfolio.json     # starting portfolio (source of truth)
│   ├── tests/
│   │   └── test_calculations.py
│   └── requirements.txt
│
├── src/                       # React frontend (existing Vite+ scaffold)
│   ├── main.tsx
│   ├── App.tsx                # layout, polls backend, composes sections
│   ├── index.css              # Tailwind entry (@import "tailwindcss")
│   ├── types/dashboard.ts     # TS types mirroring the API response
│   ├── lib/format.ts
│   ├── hooks/useDashboard.ts  # 60s poll of /api/dashboard
│   ├── hooks/useNow.ts        # 1s ticker for funding countdown
│   └── components/
│       ├── SummaryCards.tsx   # Section A
│       ├── ExposurePies.tsx   # Section B (Recharts, 2 donuts)
│       ├── PositionsTable.tsx # Section B
│       ├── EquityChart.tsx    # Section C (TradingView line)
│       └── FundingApr.tsx     # Section D (APR per pair)
│
├── docs/
│   └── code-review.md         # code-review standard (referenced from AGENTS.md)
├── vite.config.ts             # proxy /api → localhost:8000 + @tailwindcss/vite
├── PLAN.md                    # this file
└── README.md                  # setup + run instructions (required)
```

## 6. API Contract

`GET /api/dashboard` (FastAPI) → single JSON payload:

```
{
  updatedAt: string,
  summary: { totalEquity, totalUnrealisedPnl, totalExpectedFunding, netDeltaRatio },
  positions: [{ symbol, instrument, side, qty, entryPrice, currentPrice,
                notional, pnl, fundingRate, nextFundingTime, expectedFunding }],
  pairs:     [{ asset, spotNotional, perpNotional, netExposure, fundingApr }]
}
```

- FastAPI polls Bybit every 60s in a background asyncio task and caches the tickers.
- React polls `/api/dashboard` every 60s and appends `{ time, equity }` client-side for the
  line chart (matches "when the app is open").
- Funding countdown (`HH:MM:SS`) ticks locally every 1s from `nextFundingTime`.

## 7. Dashboard Sections

- **A — Summary Cards**: Total Account Equity, Total Unrealised PnL, Total Expected Next
  Funding, Total Net Delta Exposure (as % of equity).
- **B — Positions Breakdown**: two Recharts pie/donut charts (spot notional, perp notional)
  - a sorted table (symbol, instrument, side, qty, entry, live price, live value, PnL,
    funding rate %, funding countdown, expected funding).
- **C — Live Chart**: TradingView line chart of Total Account Equity over time (1 point/min).
- **D — Extra Feature**: **Funding APR per pair** (`fundingRate × 3 × 365`) + aggregate,
  showing which legs are actually earning the arbitrage yield.

> **USDT in the pies** — the pies show the four arbitrage assets (BTC/ETH/SOL/HYPE). USDT is
> cash (settlement currency, zero market exposure), not an arbitrage leg; including it would
> break the mirror-image delta-neutral visualization (the perp side has no USDT). USDT still
> appears in the summary (equity) and the positions table.

## 8. Styling (Tailwind CSS)

- Tailwind CSS v4 via `@tailwindcss/vite` plugin, added alongside `react()` in
  `vite.config.ts`.
- Entry CSS becomes `@import "tailwindcss";`; remove the unused `App.css`.
- Dark, "trading terminal" theme; metric cards with positive/negative color coding
  (green/red for PnL and funding).

## 9. Setup & Run (README outline)

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (separate terminal, from repo root)
vp install
vp dev   # Vite proxies /api → localhost:8000
```

## 10. Code Review Standard

All changes are reviewed against the standard in [`docs/code-review.md`](docs/code-review.md),
which is referenced from `AGENTS.md` so it is always applied. Reviews run along two
independent axes — **Standards** (repository rules + maintainable design) and **Spec**
(conformance + concrete correctness) — and keep findings separate.

## 11. Implementation Order

1. Scaffold backend (`main.py`, `models.py`, `portfolio.py`, `calculations.py`,
   `market_data.py`) + `pytest` for the calculation layer.
2. Wire `/api/dashboard` and the 60s Bybit poll.
3. Set up frontend deps: `tailwindcss`, `@tailwindcss/vite`, `recharts`,
   `lightweight-charts`.
4. Configure the Vite `/api` proxy + Tailwind entry.
5. Build `useDashboard` + `useNow` hooks, then the five components (A–D).
6. Write `README.md` with setup/run instructions.
7. Code review per `docs/code-review.md` before the demo.

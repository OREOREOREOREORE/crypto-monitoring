# Funding Arbitrage Monitor

A real-time web dashboard that monitors a delta-neutral funding-rate arbitrage portfolio.

It loads a mock portfolio (4 long spot positions hedged by 4 short perpetual positions), pulls live
market data from the Bybit public API, computes metrics, and refreshes on an adjustable interval.

## Features

### Core

- **Summary metrics** — Total Account Equity, Total Unrealised PnL, Total Expected Next Funding,
  and Net Delta Exposure (as % of equity), shown in the equity chart header.
- **Exposure donuts** — two pie charts (spot and perp notional) with a center total and per-asset
  values.
- **Positions table** — Symbol, Instrument, Side, Quantity, Entry/Current Price, Position Value,
  Unrealised PnL, Funding Rate, a `HH:MM:SS` countdown to next funding, and Expected Funding.
- **Live equity chart** — TradingView area/line chart of total account equity over time, with a
  PnL-per-minute histogram pane and a dashed break-even (starting balance) line.
  - **Chart customization** — SMA overlay, cumulative-PnL baseline view, session high/low lines and
    markers, grid / price-axis / last-value / trailing-line toggles, crosshair mode, and up/down
    "live tick" markers.

### Extra features

- **Funding Yield** — per-pair annualized funding **APR** and compounded **APY** as diverging
  green/red bars with a weighted average.

## Tech stack

- **Backend**: Python + FastAPI (uvicorn, httpx, pydantic)
- **Frontend**: React 19 + TypeScript + Vite (Vite+), Tailwind CSS
- **Charts**: TradingView Lightweight Charts + Recharts

## Prerequisites

- Python 3.12+
- Node.js 20+ with [Vite+](https://viteplus.dev) (`vp`)

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional: override the Bybit cache interval (default 60s):

```bash
REFRESH_INTERVAL_SECONDS=30 uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

In a separate terminal, from the repo root:

```bash
vp install
vp dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the backend on port 8000.

## How it works

The backend refreshes Bybit's spot and linear ticker endpoints **on demand**, at most once per
refresh interval (default 60s; override with `REFRESH_INTERVAL_SECONDS`). `GET /api/dashboard`
computes the derived metrics from the cached prices and the starting portfolio
(`backend/app/portfolio.json`) and returns them as JSON:

- `summary` — Total Equity, Starting Balance, Unrealised PnL, Expected Funding, Net Delta ratio.
- `positions` — one row per position with live price, notional, PnL, funding, and countdown data.
- `pairs` — per-asset spot/perp notional, net exposure, and funding APR/APY.

The frontend polls that endpoint on an adjustable interval and renders the dashboard; the funding
countdown ticks locally every second.

## Project structure

```
backend/
  app/
    calculations.py    pure formulas (unit-tested)
    market_data.py     on-demand Bybit client + min-interval cache
    portfolio.py       loads portfolio.json
    models.py          pydantic schemas
    main.py            /api/dashboard, /health, /v1/models
  tests/               pytest
src/
  components/          EquityChart, ExposurePies, PositionsTable, FundingYield, ...
  hooks/               useDashboard, useEquityChart, useEquityHistory, ...
  lib/format.ts        number / percent / countdown formatting
  types/dashboard.ts   API response types
CONTEXT.md             domain glossary
PLAN.md                architecture, formulas, file structure
docs/code-review.md    code-review standard
```

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

## Code review

All changes are reviewed against the standard in `docs/code-review.md`.

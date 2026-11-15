# Funding Arbitrage Monitor

A real-time web dashboard that monitors a delta-neutral funding-rate arbitrage portfolio.

it loads a mock portfolio (4 long spot positions hedged by 4 short perpetual positions), pulls live market data
from the Bybit public API, computes metrics, and refreshes every minute.

## Features

- **Summary cards** — Total Account Equity, Total Unrealised PnL, Total Expected Next Funding,
  and Net Delta Exposure (as % of equity).
- **Exposure donuts** — spot and perp notional exposure per asset.
- **Positions table** — full breakdown with live prices, PnL, funding rate, and a countdown to
  the next funding settlement.
- **Live equity chart** — TradingView line chart of total account equity over time.
- **Funding APR** — annualized funding yield per pair (extra feature).

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

### 2. Frontend

In a separate terminal, from the repo root:

```bash
vp install
vp dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the backend on port 8000.

## How it works

The backend refreshes Bybit's spot and linear ticker endpoints on demand, at most once per
refresh interval (default 60s; override with the `REFRESH_INTERVAL_SECONDS` env var). `GET
/api/dashboard` computes the derived metrics from the cached prices and the starting portfolio
(`backend/app/portfolio.json`) and returns them as JSON. The frontend polls that endpoint on an
adjustable interval (15s/30s/1m via the **Refresh** selector in the header) and renders the
dashboard; the funding countdown ticks locally every second.

Calculation logic lives in `backend/app/calculations.py` (pure and unit-tested).

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

## Code review

All changes are reviewed against the standard in `docs/code-review.md`.

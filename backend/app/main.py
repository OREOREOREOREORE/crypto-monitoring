"""FastAPI app serving the dashboard API."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .calculations import compute_dashboard
from .market_data import MarketData
from .models import DashboardResponse
from .portfolio import load_portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    market_data = MarketData()
    await market_data.start()
    app.state.market_data = market_data
    app.state.portfolio = load_portfolio()
    yield
    await market_data.stop()


app = FastAPI(title="Portfolio Monitoring", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/dashboard", response_model=DashboardResponse)
async def dashboard(request: Request) -> DashboardResponse:
    market_data: MarketData = request.app.state.market_data
    return compute_dashboard(
        request.app.state.portfolio,
        market_data.spot_prices,
        market_data.perp_data,
        market_data.updated_at or "",
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

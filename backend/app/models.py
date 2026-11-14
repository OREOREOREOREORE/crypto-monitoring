"""Pydantic models for the portfolio-monitoring domain and API."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class Instrument(str, Enum):
    SPOT = "SPOT"
    PERP = "PERP"


class Side(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class Position(BaseModel):
    asset: str
    symbol: str
    instrument: Instrument
    side: Side
    quantity: float
    entry_price_usdt: float


class Portfolio(BaseModel):
    account_name: str
    positions: list[Position]


class PerpTicker(BaseModel):
    symbol: str
    mark_price: float
    funding_rate: float
    next_funding_time: int


class Summary(BaseModel):
    total_equity: float
    starting_balance: float
    total_unrealised_pnl: float
    total_expected_funding: float
    net_delta_ratio: float


class PositionView(BaseModel):
    asset: str
    symbol: str
    instrument: Instrument
    side: Side
    quantity: float
    entry_price: float
    current_price: float | None = None
    notional: float | None = None
    pnl: float | None = None
    funding_rate: float | None = None
    next_funding_time: int | None = None
    expected_funding: float | None = None


class PairView(BaseModel):
    asset: str
    spot_notional: float | None = None
    perp_notional: float | None = None
    net_exposure: float | None = None
    funding_apr: float | None = None


class DashboardResponse(BaseModel):
    updated_at: str
    summary: Summary
    positions: list[PositionView]
    pairs: list[PairView]

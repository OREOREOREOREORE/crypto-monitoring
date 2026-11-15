"""Async Bybit market-data client with on-demand, min-interval refresh."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from .models import PerpTicker

BYBIT_BASE = "https://api.bybit.com"
SPOT_TICKERS_URL = f"{BYBIT_BASE}/v5/market/tickers?category=spot"
LINEAR_TICKERS_URL = f"{BYBIT_BASE}/v5/market/tickers?category=linear"

logger = logging.getLogger(__name__)


def _to_float(value: object) -> float | None:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _result_list(resp: httpx.Response) -> list[dict]:
    payload = resp.json()
    if payload.get("retCode") != 0:
        raise RuntimeError(f"Bybit error {payload.get('retCode')}: {payload.get('retMsg')}")
    return payload["result"]["list"]


class MarketData:
    """Caches Bybit tickers; refreshes on demand at most once per `refresh_interval` seconds."""

    def __init__(self, refresh_interval: float = 60.0) -> None:
        self.spot_prices: dict[str, float] = {}
        self.perp_data: dict[str, PerpTicker] = {}
        self.updated_at: str | None = None
        self.refresh_interval = refresh_interval
        self._lock = asyncio.Lock()
        self._last_refresh: datetime | None = None

    def _is_stale(self) -> bool:
        if self._last_refresh is None:
            return True
        elapsed = (datetime.now(timezone.utc) - self._last_refresh).total_seconds()
        return elapsed >= self.refresh_interval

    async def refresh(self) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            spot_resp, linear_resp = await asyncio.gather(
                client.get(SPOT_TICKERS_URL),
                client.get(LINEAR_TICKERS_URL),
            )
        spot_resp.raise_for_status()
        linear_resp.raise_for_status()

        spot_list = _result_list(spot_resp)
        linear_list = _result_list(linear_resp)

        # Some tickers carry empty strings for price/funding fields; skip them.
        spot_prices: dict[str, float] = {}
        for t in spot_list:
            price = _to_float(t.get("lastPrice"))
            if price is not None:
                spot_prices[t["symbol"]] = price

        perp_data: dict[str, PerpTicker] = {}
        for t in linear_list:
            mark = _to_float(t.get("markPrice"))
            rate = _to_float(t.get("fundingRate"))
            nft = t.get("nextFundingTime")
            if mark is None or rate is None or nft in (None, ""):
                continue
            perp_data[t["symbol"]] = PerpTicker(
                symbol=t["symbol"],
                mark_price=mark,
                funding_rate=rate,
                next_funding_time=int(nft),
            )

        self.spot_prices = spot_prices
        self.perp_data = perp_data
        self._last_refresh = datetime.now(timezone.utc)
        self.updated_at = self._last_refresh.isoformat()

    async def ensure_fresh(self) -> None:
        if not self._is_stale():
            return
        async with self._lock:
            if not self._is_stale():
                return
            try:
                await self.refresh()
            except Exception as exc:
                logger.warning("Market data refresh failed: %s", exc)
                self._last_refresh = datetime.now(timezone.utc)  # throttle retries

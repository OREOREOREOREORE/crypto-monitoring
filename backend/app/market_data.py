"""Async Bybit market-data client with a periodic in-memory cache."""

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


def _to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class MarketData:
    """Caches Bybit spot prices and perp tickers, refreshed every minute."""

    def __init__(self, refresh_interval: float = 60.0) -> None:
        self.spot_prices: dict[str, float] = {}
        self.perp_data: dict[str, PerpTicker] = {}
        self.updated_at: str | None = None
        self.refresh_interval = refresh_interval
        self._task: asyncio.Task | None = None

    async def refresh(self) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            spot_resp, linear_resp = await asyncio.gather(
                client.get(SPOT_TICKERS_URL),
                client.get(LINEAR_TICKERS_URL),
            )
        spot_resp.raise_for_status()
        linear_resp.raise_for_status()

        spot_list = spot_resp.json()["result"]["list"]
        linear_list = linear_resp.json()["result"]["list"]

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
        self.updated_at = datetime.now(timezone.utc).isoformat()

    async def start(self) -> None:
        try:
            await self.refresh()
        except Exception as exc:  # serve empty data on startup failure; keep polling
            logger.warning("Initial market data refresh failed: %s", exc)
        self._task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(self.refresh_interval)
            try:
                await self.refresh()
            except Exception as exc:  # keep serving last good data on failure
                logger.warning("Market data refresh failed: %s", exc)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

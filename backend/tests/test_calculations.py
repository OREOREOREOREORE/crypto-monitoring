"""Tests for the pure calculation layer."""

from __future__ import annotations

import pytest

from app.calculations import (
    compute_dashboard,
    expected_funding,
    funding_apr,
    position_pnl,
    side_sign,
    starting_balance,
)
from app.models import Instrument, PerpTicker, Portfolio, Position, Side


def pos(
    asset: str,
    symbol: str,
    instrument: Instrument,
    side: Side,
    quantity: float,
    entry: float,
) -> Position:
    return Position(
        asset=asset,
        symbol=symbol,
        instrument=instrument,
        side=side,
        quantity=quantity,
        entry_price_usdt=entry,
    )


def test_side_sign() -> None:
    assert side_sign(Side.LONG) == 1.0
    assert side_sign(Side.SHORT) == -1.0


def test_long_spot_pnl() -> None:
    p = pos("BTC", "BTCUSDT", Instrument.SPOT, Side.LONG, 1.0, 70000.0)
    assert position_pnl(p, 71000.0) == 1000.0


def test_short_perp_pnl() -> None:
    p = pos("BTC", "BTCUSDT", Instrument.PERP, Side.SHORT, 1.0, 70000.0)
    assert position_pnl(p, 71000.0) == -1000.0


def test_expected_funding_short_receives_when_positive_rate() -> None:
    p = pos("BTC", "BTCUSDT", Instrument.PERP, Side.SHORT, 1.0, 70000.0)
    # signed notional = -70000; funding = -(-70000) * 0.0001 = +7.0
    assert expected_funding(p, 70000.0, 0.0001) == pytest.approx(7.0)


def test_funding_apr() -> None:
    assert funding_apr(0.0001) == pytest.approx(0.0001 * 3 * 365)


def test_starting_balance_from_usdt() -> None:
    portfolio = Portfolio(
        account_name="t",
        positions=[
            pos("USDT", "USDT", Instrument.SPOT, Side.LONG, 50000.0, 1.0),
            pos("BTC", "BTCUSDT", Instrument.SPOT, Side.LONG, 1.0, 70000.0),
        ],
    )
    assert starting_balance(portfolio) == 50000.0


def test_compute_dashboard_delta_neutral() -> None:
    portfolio = Portfolio(
        account_name="t",
        positions=[
            pos("USDT", "USDT", Instrument.SPOT, Side.LONG, 50000.0, 1.0),
            pos("BTC", "BTCUSDT", Instrument.SPOT, Side.LONG, 1.0, 70000.0),
            pos("BTC", "BTCUSDT", Instrument.PERP, Side.SHORT, 1.0, 70000.0),
        ],
    )
    spot_prices = {"BTCUSDT": 70000.0}
    perp_data = {
        "BTCUSDT": PerpTicker(
            symbol="BTCUSDT",
            mark_price=70000.0,
            funding_rate=0.0001,
            next_funding_time=1_794_585_600_000,
        )
    }

    result = compute_dashboard(portfolio, spot_prices, perp_data, "2026-01-01T00:00:00+00:00")

    assert result.summary.total_equity == pytest.approx(50000.0)
    assert result.summary.starting_balance == pytest.approx(50000.0)
    assert result.summary.total_unrealised_pnl == pytest.approx(0.0)
    assert result.summary.total_expected_funding == pytest.approx(7.0)
    assert result.summary.net_delta_ratio == pytest.approx(0.0)
    assert result.pairs[0].net_exposure == pytest.approx(0.0)
    assert result.pairs[0].funding_apr == pytest.approx(0.0001 * 3 * 365)


def test_positions_sorted_spot_before_perp_and_usdt_last() -> None:
    portfolio = Portfolio(
        account_name="t",
        positions=[
            pos("USDT", "USDT", Instrument.SPOT, Side.LONG, 50000.0, 1.0),
            pos("BTC", "BTCUSDT", Instrument.PERP, Side.SHORT, 1.0, 70000.0),
            pos("BTC", "BTCUSDT", Instrument.SPOT, Side.LONG, 1.0, 70000.0),
        ],
    )
    spot_prices = {"BTCUSDT": 70000.0}
    perp_data = {
        "BTCUSDT": PerpTicker(
            symbol="BTCUSDT",
            mark_price=70000.0,
            funding_rate=0.0,
            next_funding_time=0,
        )
    }

    result = compute_dashboard(portfolio, spot_prices, perp_data, "")

    assert [p.asset for p in result.positions] == ["BTC", "BTC", "USDT"]
    assert [p.instrument.value for p in result.positions] == ["SPOT", "PERP", "SPOT"]


def test_missing_ticker_produces_nulls() -> None:
    portfolio = Portfolio(
        account_name="t",
        positions=[
            pos("USDT", "USDT", Instrument.SPOT, Side.LONG, 50000.0, 1.0),
            pos("HYPE", "HYPEUSDT", Instrument.SPOT, Side.LONG, 10.0, 88.0),
            pos("HYPE", "HYPEUSDT", Instrument.PERP, Side.SHORT, 10.0, 88.0),
        ],
    )
    result = compute_dashboard(portfolio, {}, {}, "")

    hype_spot = next(p for p in result.positions if p.symbol == "HYPEUSDT" and p.instrument == Instrument.SPOT)
    assert hype_spot.current_price is None
    assert hype_spot.notional is None
    assert hype_spot.pnl is None
    assert result.summary.total_equity == pytest.approx(50000.0)

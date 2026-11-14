"""Pure calculation functions for the funding-arbitrage dashboard.

This module performs no I/O: every function takes plain values/models and
returns values. Sign convention: ``sign = +1`` for LONG, ``-1`` for SHORT.
"""

from __future__ import annotations

from .models import (
    DashboardResponse,
    Instrument,
    PairView,
    PerpTicker,
    Portfolio,
    Position,
    PositionView,
    Side,
    Summary,
)

USDT_ASSET = "USDT"
FUNDING_PAYMENTS_PER_DAY = 3
# Canonical asset ordering for the positions table (USDT last).
ASSET_ORDER = {"BTC": 0, "ETH": 1, "SOL": 2, "HYPE": 3, USDT_ASSET: 4}


def side_sign(side: Side) -> float:
    return 1.0 if side == Side.LONG else -1.0


def starting_balance(portfolio: Portfolio) -> float:
    for pos in portfolio.positions:
        if pos.asset == USDT_ASSET:
            return pos.quantity
    return 0.0


def _current_price(
    pos: Position,
    spot_prices: dict[str, float],
    perp_data: dict[str, PerpTicker],
) -> float | None:
    if pos.asset == USDT_ASSET:
        return 1.0
    if pos.instrument == Instrument.SPOT:
        return spot_prices.get(pos.symbol)
    ticker = perp_data.get(pos.symbol)
    return ticker.mark_price if ticker else None


def position_pnl(pos: Position, current_price: float) -> float:
    return side_sign(pos.side) * (current_price - pos.entry_price_usdt) * pos.quantity


def signed_notional(pos: Position, current_price: float) -> float:
    return side_sign(pos.side) * pos.quantity * current_price


def expected_funding(pos: Position, current_price: float, funding_rate: float) -> float:
    # Short perp receives when r > 0; long perp pays.
    return -signed_notional(pos, current_price) * funding_rate


def funding_apr(funding_rate: float) -> float:
    return funding_rate * FUNDING_PAYMENTS_PER_DAY * 365


def _sort_key(pos: Position) -> tuple[int, bool]:
    return (ASSET_ORDER.get(pos.asset, 99), pos.instrument == Instrument.PERP)


def _position_view(
    pos: Position,
    spot_prices: dict[str, float],
    perp_data: dict[str, PerpTicker],
) -> PositionView:
    price = _current_price(pos, spot_prices, perp_data)

    if pos.asset == USDT_ASSET:
        return PositionView(
            asset=pos.asset,
            symbol=pos.symbol,
            instrument=pos.instrument,
            side=pos.side,
            quantity=pos.quantity,
            entry_price=1.0,
            current_price=1.0,
            notional=pos.quantity,
            pnl=0.0,
        )

    funding_rate = None
    next_funding_time = None
    expected = None
    if pos.instrument == Instrument.PERP:
        ticker = perp_data.get(pos.symbol)
        if ticker is not None:
            funding_rate = ticker.funding_rate
            next_funding_time = ticker.next_funding_time
            if price is not None:
                expected = expected_funding(pos, price, funding_rate)

    return PositionView(
        asset=pos.asset,
        symbol=pos.symbol,
        instrument=pos.instrument,
        side=pos.side,
        quantity=pos.quantity,
        entry_price=pos.entry_price_usdt,
        current_price=price,
        notional=(pos.quantity * price) if price is not None else None,
        pnl=position_pnl(pos, price) if price is not None else None,
        funding_rate=funding_rate,
        next_funding_time=next_funding_time,
        expected_funding=expected,
    )


def _pair_view(
    asset: str,
    spot: Position | None,
    perp: Position | None,
    spot_prices: dict[str, float],
    perp_data: dict[str, PerpTicker],
) -> PairView:
    spot_price = _current_price(spot, spot_prices, perp_data) if spot else None
    perp_price = _current_price(perp, spot_prices, perp_data) if perp else None

    spot_notional = (
        spot.quantity * spot_price if spot and spot_price is not None else None
    )
    perp_notional = (
        perp.quantity * perp_price if perp and perp_price is not None else None
    )

    net_exposure = (
        spot_notional - perp_notional
        if spot_notional is not None and perp_notional is not None
        else None
    )

    apr = None
    if perp is not None:
        ticker = perp_data.get(perp.symbol)
        if ticker is not None:
            apr = funding_apr(ticker.funding_rate)

    return PairView(
        asset=asset,
        spot_notional=spot_notional,
        perp_notional=perp_notional,
        net_exposure=net_exposure,
        funding_apr=apr,
    )


def _compute_pairs(
    portfolio: Portfolio,
    spot_prices: dict[str, float],
    perp_data: dict[str, PerpTicker],
) -> list[PairView]:
    legs: dict[str, dict[str, Position]] = {}
    for pos in portfolio.positions:
        if pos.asset == USDT_ASSET:
            continue
        legs.setdefault(pos.asset, {})[pos.instrument.value] = pos

    return [
        _pair_view(asset, slots.get("SPOT"), slots.get("PERP"), spot_prices, perp_data)
        for asset, slots in legs.items()
    ]


def compute_dashboard(
    portfolio: Portfolio,
    spot_prices: dict[str, float],
    perp_data: dict[str, PerpTicker],
    updated_at: str,
) -> DashboardResponse:
    positions = sorted(portfolio.positions, key=_sort_key)
    position_views = [_position_view(p, spot_prices, perp_data) for p in positions]

    total_pnl = sum(v.pnl for v in position_views if v.pnl is not None)
    total_expected_funding = sum(
        v.expected_funding for v in position_views if v.expected_funding is not None
    )

    pairs = _compute_pairs(portfolio, spot_prices, perp_data)
    total_net_exposure = sum(
        p.net_exposure for p in pairs if p.net_exposure is not None
    )

    start_balance = starting_balance(portfolio)
    equity = start_balance + total_pnl
    net_delta_ratio = (total_net_exposure / equity) if equity else 0.0

    return DashboardResponse(
        updated_at=updated_at,
        summary=Summary(
            total_equity=equity,
            starting_balance=start_balance,
            total_unrealised_pnl=total_pnl,
            total_expected_funding=total_expected_funding,
            net_delta_ratio=net_delta_ratio,
        ),
        positions=position_views,
        pairs=pairs,
    )

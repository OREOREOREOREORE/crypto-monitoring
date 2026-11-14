"""Load the starting portfolio from portfolio.json."""

from __future__ import annotations

import json
from pathlib import Path

from .models import Portfolio

DEFAULT_PATH = Path(__file__).parent / "portfolio.json"


def load_portfolio(path: Path | str = DEFAULT_PATH) -> Portfolio:
    data = json.loads(Path(path).read_text())
    return Portfolio.model_validate(data)

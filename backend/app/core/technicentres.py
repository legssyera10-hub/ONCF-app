from __future__ import annotations

TECHNICENTRE_DEFINITIONS: list[tuple[str, str, str]] = [
    ("TMF", "TMF", "TMF"),
    ("TMIC", "TMIC", "TMIC"),
    ("TMIJ", "TMIJ", "TMIJ"),
    ("TMIM", "TMIM", "TMIM"),
    ("TMIO", "TMIO", "TMIO"),
    ("TMIS", "TMIS", "TMIS"),
    ("TMK", "TMK", "TMK"),
    ("TMLC", "TMLC", "TMLC"),
    ("TMM", "TMM", "TMM"),
    ("TMN", "TMN", "TMN"),
    ("TMRC", "TMRC", "TMRC"),
    ("TMT", "TMT", "TMT"),
    ("TMVC", "TMVC", "TMVC"),
]

TECHNICENTRE_CODES = {code for code, _name, _city in TECHNICENTRE_DEFINITIONS}

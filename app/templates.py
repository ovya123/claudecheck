"""Predefined interactive mini-lesson templates.

The AI never generates frontend code. It picks one of these templates and fills in
validated parameters; the frontend owns one reusable component per template.
"""

import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

_FRACTION_RE = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")


def _check_fraction(value: str) -> str:
    m = _FRACTION_RE.match(value)
    if not m or int(m.group(2)) == 0 or int(m.group(2)) > 24:
        raise ValueError(f"invalid fraction {value!r}")
    return f"{int(m.group(1))}/{int(m.group(2))}"


class FractionPizzaParams(BaseModel):
    """Same pizza, sliced into different numbers of equal pieces. Student toggles between them."""

    denominators: list[int] = Field(default=[4, 8], min_length=2, max_length=4)
    highlight_slices: int = Field(default=1, ge=1, le=12)

    @field_validator("denominators")
    @classmethod
    def _range(cls, v: list[int]) -> list[int]:
        if any(d < 2 or d > 12 for d in v):
            raise ValueError("denominators must be between 2 and 12")
        return v


class FractionBarsParams(BaseModel):
    """Equal-length bars, each split per fraction, stacked for side-by-side comparison."""

    fractions: list[str] = Field(default=["1/2", "1/4", "1/8"], min_length=2, max_length=5)

    @field_validator("fractions")
    @classmethod
    def _fracs(cls, v: list[str]) -> list[str]:
        return [_check_fraction(f) for f in v]


class NumberLineParams(BaseModel):
    """A 0–1 (or 0–max) number line on which the student places fractions."""

    fractions: list[str] = Field(default=["1/4", "1/2", "3/4"], min_length=1, max_length=6)
    max_value: int = Field(default=1, ge=1, le=3)

    @field_validator("fractions")
    @classmethod
    def _fracs(cls, v: list[str]) -> list[str]:
        return [_check_fraction(f) for f in v]


TEMPLATES: dict[str, dict[str, Any]] = {
    "fraction_pizza": {
        "model": FractionPizzaParams,
        "description": "Interactive pizza that the student re-slices into different numbers of equal pieces "
        "(e.g. 4 vs 8) to see how each slice shrinks as the denominator grows.",
        "params_hint": {"denominators": "list of 2-4 ints between 2 and 12", "highlight_slices": "int, slices shaded"},
    },
    "fraction_bars": {
        "model": FractionBarsParams,
        "description": "Stacked equal-length bars split into fractions for visual size comparison; good for "
        "comparing fractions and equivalent fractions.",
        "params_hint": {"fractions": "list of 2-5 strings like '1/3'"},
    },
    "number_line": {
        "model": NumberLineParams,
        "description": "Number line where students place fractions; good for ordering fractions and "
        "fractions greater than one.",
        "params_hint": {"fractions": "list of 1-6 strings like '3/4'", "max_value": "int 1-3"},
    },
}

DEFAULT_TEMPLATE = "fraction_pizza"


def template_catalog() -> list[dict[str, Any]]:
    return [
        {"template": name, "description": t["description"], "params": t["params_hint"]}
        for name, t in TEMPLATES.items()
    ]


def validate_template(template: str, params: dict[str, Any] | None) -> tuple[str, dict[str, Any]]:
    """Return a known template + valid params, falling back to defaults when the AI goes off-script."""
    if template not in TEMPLATES:
        template = DEFAULT_TEMPLATE
    model = TEMPLATES[template]["model"]
    try:
        return template, model(**(params or {})).model_dump()
    except (ValidationError, TypeError):
        return template, model().model_dump()

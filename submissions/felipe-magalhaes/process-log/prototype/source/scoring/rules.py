from __future__ import annotations

AGE_EDGES = [0, 16, 46, 91, 121, 139]
AGE_LABELS = ["0-15", "16-45", "46-90", "91-120", "121-138"]
MAX_AGE = 138
VERSION = "1.0.0"


def age_band(age: int) -> str:
    for lower, upper, label in zip(AGE_EDGES[:-1], AGE_EDGES[1:], AGE_LABELS):
        if lower <= age < upper:
            return label
    raise ValueError(f"Age {age} is outside model coverage")

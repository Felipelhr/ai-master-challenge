"""Export the validated legacy engine output for a full 2,089-deal parity test.

Usage: python scripts/scoring/export-legacy-fixture.py PATH_TO_G4_003_SOLUTION
The legacy project is imported read-only; output is written only in this repo.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pandas as pd


if len(sys.argv) != 2:
    raise SystemExit("Expected path to the legacy solution directory")

legacy = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(legacy))
from scoring.engine import score_new_opportunity, score_snapshot  # noqa: E402
from scoring.model import load_data  # noqa: E402

scored = score_snapshot()
rows = {}
for row in scored.to_dict("records"):
    rows[row["opportunity_id"]] = {
        "priorityScore": int(row["Priority Score"]),
        "scoreBasis": row["Score Basis"],
        "confidence": row["Confidence"],
        "action": row["Action Tag"],
        "propensity30d": None if pd.isna(row["propensity_30d"]) else float(row["propensity_30d"]),
        "priorityValue": None if pd.isna(row["priority_value"]) else float(row["priority_value"]),
        "systemSignals": [tag for tag in row["Auxiliary Tags"] if tag not in ("TOP_5_SELLER", "FOLLOWUP_AUTOMATIZADO")],
    }

fixture = {
    "sourceEngineSha256": hashlib.sha256((legacy / "scoring" / "engine.py").read_bytes()).hexdigest(),
    "sourceModelSha256": hashlib.sha256((legacy / "models" / "model.joblib").read_bytes()).hexdigest(),
    "asOfDate": "2017-12-31",
    "rows": rows,
}

source = load_data().loc[lambda frame: frame["account"].notna()].iloc[0]
new_cases = [
    {
        "name": "known",
        "input": {
            "product": source["product"], "account": source["account"], "deal_stage": "Engaging",
            "engage_date": "2017-12-01", "sector": source["sector"], "revenue": source["revenue"],
            "employees": source["employees"], "year_established": source["year_established"],
            "subsidiary_of": None if pd.isna(source["subsidiary_of"]) else source["subsidiary_of"],
        },
    },
    {"name": "missing", "input": {"product": "GTX Pro", "account": None, "deal_stage": "Engaging", "engage_date": "2017-12-01"}},
    {"name": "out_of_coverage", "input": {"product": "GTX Pro", "account": None, "deal_stage": "Engaging", "engage_date": "2017-07-01"}},
    {"name": "prospecting", "input": {"product": "GTX Pro", "account": None, "deal_stage": "Prospecting", "engage_date": None}},
]
for case in new_cases:
    values = {"opportunity_id": "SIMULACAO", "sales_agent": "Anna Snelling", **case["input"]}
    result = score_new_opportunity(values, scored).iloc[0]
    case["expected"] = {
        "priorityScore": int(result["Priority Score"]),
        "scoreBasis": result["Score Basis"],
        "confidence": result["Confidence"],
        "action": result["Action Tag"],
        "propensity30d": None if pd.isna(result["propensity_30d"]) else float(result["propensity_30d"]),
        "priorityValue": None if pd.isna(result["priority_value"]) else float(result["priority_value"]),
    }
fixture["newCases"] = new_cases
output = Path(__file__).resolve().parent / "fixtures" / "legacy-snapshot.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(fixture, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Wrote {len(rows)} legacy scores to {output}")

from __future__ import annotations

import pandas as pd

from scoring.engine import score_new_opportunity, score_snapshot
from scoring.model import load_data


def test_scoring_engine():
    scored = score_snapshot()
    assert len(scored) == 2089
    assert scored["Priority Score"].between(0, 100).all()
    assert scored["Score Basis"].value_counts().to_dict() == {"OUT_OF_COVERAGE_VALUE": 1291, "PROSPECTING_VALUE": 500, "AGE_ONLY_FALLBACK": 209, "MODEL_FULL": 89}
    expected = {
        "MODEL_FULL": ("MEDIUM", "ACTION_WORK_NOW", "MODEL_FULL"),
        "AGE_ONLY_FALLBACK": ("LOW", "ACTION_ENRICH_ACCOUNT", "ACCOUNT_MISSING"),
        "OUT_OF_COVERAGE_VALUE": ("LOW", "ACTION_LAST_CONTACT_BEFORE_FREEZE", "OUT_OF_COVERAGE_AGE"),
        "PROSPECTING_VALUE": ("LOW", "ACTION_QUALIFY_PROSPECTING", "PROSPECTING_NO_ENGAGE_DATE"),
    }
    for basis, (confidence, action, tag) in expected.items():
        subset = scored[scored["Score Basis"] == basis]
        assert (subset["Confidence"] == confidence).all()
        assert (subset["Action Tag"] == action).all()
        assert subset["Auxiliary Tags"].map(lambda tags: tag in tags).all()
        assert subset["reason"].str.len().gt(20).all()
        assert subset["next_action"].str.len().gt(10).all()
    assert scored.loc[scored["Score Basis"].isin(["PROSPECTING_VALUE", "OUT_OF_COVERAGE_VALUE"]), "propensity_30d"].isna().all()
    assert scored["Auxiliary Tags"].map(lambda tags: "FOLLOWUP_AUTOMATIZADO" in tags and "TOP_5_SELLER" not in tags).sum() == 0
    assert scored["Auxiliary Tags"].map(lambda tags: "FOLLOWUP_AUTOMATIZADO" in tags).sum() > 0

    source = load_data().loc[lambda d: d["account"].notna()].iloc[0]
    values = {"opportunity_id": "NEW", "sales_agent": source["sales_agent"], "product": source["product"], "account": source["account"], "deal_stage": "Engaging", "engage_date": pd.Timestamp("2017-12-01")}
    for field in ["sector", "revenue", "employees", "year_established", "subsidiary_of"]:
        values[field] = source[field]
    result = score_new_opportunity(values, scored)
    assert result.iloc[0]["Score Basis"] == "MODEL_FULL"
    assert 0 <= result.iloc[0]["Priority Score"] <= 100


if __name__ == "__main__":
    test_scoring_engine()
    print("TEST 1 PASS")

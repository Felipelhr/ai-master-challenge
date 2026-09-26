"""New retrospective benchmark; does not reproduce the unavailable legacy experiment.

Run from solution/: python scripts/scoring/temporal-benchmark.py
Writes only scripts/scoring/benchmark-results/. Never changes the production artifact.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import platform
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("artifact_builder", HERE / "build-model-artifact.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
METHODS = ["A_PRICE", "B_AGE_PRICE", "C_AGE_PROPENSITY_PRICE", "D_MODEL_FALLBACK_PRICE"]
CUTOFFS = pd.date_range("2017-06-30", "2017-11-30", freq="ME")
OUTPUT = HERE / "benchmark-results"


def at_cut(data: pd.DataFrame, cut: pd.Timestamp) -> pd.DataFrame:
    age = (cut - data["engage_date"]).dt.days
    active = data["engage_date"].notna() & age.between(0, builder.MAX_AGE)
    active &= data["close_date"].isna() | (data["close_date"] > cut)
    frame = data.loc[active].copy()
    frame["age_days"] = age.loc[active].astype(int)
    frame["as_of_date"] = cut
    frame["label_available_at"] = cut + pd.Timedelta(days=30)
    frame["target"] = (
        frame["deal_stage"].eq("Won")
        & frame["close_date"].between(cut + pd.Timedelta(days=1), cut + pd.Timedelta(days=30))
    ).astype(int)
    return frame


def fit_at(data: pd.DataFrame, cut: pd.Timestamp):
    # All training label windows have ended before the simulated decision.
    cuts = [date for date in pd.date_range("2017-03-31", cut, freq="ME")
            if date + pd.Timedelta(days=30) <= cut and date < cut]
    training = pd.concat([at_cut(data, date) for date in cuts], ignore_index=True)
    training = training.loc[training["account"].notna()].copy()
    assert training["label_available_at"].max() <= cut
    assert training["as_of_date"].max() < cut
    assert training["target"].nunique() == 2
    # Future outcomes must not affect training eligibility, features or labels.
    hidden = data.copy()
    future = hidden["close_date"] > cut
    hidden.loc[future, "close_date"] = cut + pd.Timedelta(days=1)
    hidden.loc[future, "deal_stage"] = "Lost"
    hidden["close_value"] = 0
    hidden_training = pd.concat([at_cut(hidden, date) for date in cuts], ignore_index=True)
    hidden_training = hidden_training.loc[hidden_training["account"].notna()]
    pd.testing.assert_frame_equal(training[["opportunity_id", "as_of_date", "target"]], hidden_training[["opportunity_id", "as_of_date", "target"]])
    pd.testing.assert_frame_equal(builder.feature_rows(training), builder.feature_rows(hidden_training))
    preprocessing = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), builder.NUMERIC),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), builder.CATEGORICAL),
    ])
    model = Pipeline([("preprocess", preprocessing), ("classifier", LogisticRegression(max_iter=1000, random_state=0))])
    features = builder.feature_rows(training)
    assert not set(features.columns) & {"target", "close_value", "close_date", "opportunity_id", "sales_agent"}
    model.fit(features, training["target"])
    rate = float(training["target"].mean())
    bands = training.assign(age_band=training["age_days"].map(builder.age_band)).groupby("age_band")["target"].agg(["sum", "count"])
    fallback = {band: float((bands.loc[band, "sum"] + 20 * rate) / (bands.loc[band, "count"] + 20)) if band in bands.index else rate for band in builder.AGE_LABELS}
    return model, fallback, training


def measure_cut(data: pd.DataFrame, cut: pd.Timestamp):
    model, fallback, training = fit_at(data, cut)
    evaluation = at_cut(data, cut)
    assert (evaluation["as_of_date"] + pd.Timedelta(days=30) <= pd.Timestamp(builder.AS_OF_DATE)).all()
    known = evaluation["account"].notna()
    age_probability = evaluation["age_days"].map(builder.age_band).map(fallback)
    model_probability = age_probability.copy()
    model_probability.loc[known] = model.predict_proba(builder.feature_rows(evaluation.loc[known]))[:, 1]
    signals = {
        "A_PRICE": evaluation["sales_price"],
        "B_AGE_PRICE": evaluation["age_days"] * evaluation["sales_price"],
        "C_AGE_PROPENSITY_PRICE": age_probability * evaluation["sales_price"],
        "D_MODEL_FALLBACK_PRICE": model_probability * evaluation["sales_price"],
    }
    results, selected = [], []
    for method, signal in signals.items():
        ranked = evaluation.copy()
        # Same score rounding and economic tie-break as the app's active-selling queue.
        ranked["score"] = (signal.rank(method="average", pct=True) * 100).round().astype(int)
        ranked = ranked.sort_values(["score", "sales_price", "opportunity_id"], ascending=[False, False, True], kind="stable")
        picked = ranked.groupby("sales_agent", sort=False).head(5)
        assert not picked["opportunity_id"].duplicated().any()
        assert picked.groupby("sales_agent").size().max() <= 5
        probability = age_probability if method == "C_AGE_PROPENSITY_PRICE" else model_probability if method == "D_MODEL_FALLBACK_PRICE" else None
        row = {
            "cutoff": str(cut.date()), "method": method, "training_rows": len(training),
            "last_training_cutoff": str(training["as_of_date"].max().date()),
            "last_training_label_available_at": str(training["label_available_at"].max().date()),
            "eligible": len(evaluation), "eligible_full": int(known.sum()), "eligible_fallback": int((~known).sum()),
            "available_wins": int(evaluation["target"].sum()), "selected": len(picked),
            "selected_wins": int(picked["target"].sum()),
            "selected_revenue": round(float(picked.loc[picked["target"].eq(1), "close_value"].sum()), 2),
            "precision_at_5": float(picked["target"].mean()),
            "auc": float(roc_auc_score(evaluation["target"], probability)) if probability is not None else None,
            "brier": float(brier_score_loss(evaluation["target"], probability)) if probability is not None else None,
        }
        results.append(row)
        for seller, group in picked.groupby("sales_agent", sort=True):
            for rank, (_, deal) in enumerate(group.iterrows(), 1):
                selected.append({"cutoff": str(cut.date()), "method": method, "seller": seller, "rank": rank,
                    "opportunity_id": deal["opportunity_id"], "score": int(deal["score"]),
                    "price": float(deal["sales_price"]), "won_next_30d": int(deal["target"]),
                    "realized_value_if_won": float(deal["close_value"]) if deal["target"] else 0})
    return results, selected


def main():
    data = builder.load_data()
    artifact = builder.OUTPUT.read_bytes()
    rows, selections = [], []
    for cut in CUTOFFS:
        result, selection = measure_cut(data, cut)
        rows.extend(result)
        selections.extend(selection)
    summary = []
    for method in METHODS:
        parts = [row for row in rows if row["method"] == method]
        picked = [row for row in selections if row["method"] == method]
        wins = {row["opportunity_id"]: row["realized_value_if_won"] for row in picked if row["won_next_30d"]}
        summary.append({"method": method, "selected_decisions": sum(row["selected"] for row in parts),
            "selected_wins": sum(row["selected_wins"] for row in parts),
            "selected_revenue": round(sum(row["selected_revenue"] for row in parts), 2),
            "unique_selected_opportunities": len({row["opportunity_id"] for row in picked}),
            "unique_selected_wins": len(wins), "unique_selected_revenue": round(sum(wins.values()), 2),
            "mean_auc": float(np.mean([row["auc"] for row in parts])) if method in METHODS[2:] else None})
    digest = hashlib.sha256()
    for filename in builder.DATA_FILES:
        digest.update(filename.encode())
        digest.update((builder.DATA / filename).read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    output = {"experiment": "temporal-retrospective-v1", "legacy_replication": False,
        "dataset_sha256": digest.hexdigest(), "production_artifact_canonical_sha256": hashlib.sha256(json.dumps(json.loads(artifact), sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "libraries": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__},
        "scope": "Engaging at cutoff, 0-138 days; identical universe across A/B/C/D; Top 5 per seller",
        "limitations": ["New experiment, not the unavailable legacy benchmark", "Company attributes are a single snapshot; retrospective leakage cannot be ruled out", "138-day threshold and features were chosen using the existing dataset; not an untouched prospective holdout", "Repeated opportunities across decisions; no independence or statistical significance claim", "Selection of observed outcomes is not causal revenue uplift", "No predictive evaluation for qualification or revalidation"],
        "summary": summary, "cutoffs": rows}
    if "--check" in sys.argv:
        expected = json.loads((OUTPUT / "summary.json").read_text(encoding="utf-8"))
        assert output["dataset_sha256"] == expected["dataset_sha256"]
        assert output["production_artifact_canonical_sha256"] == expected["production_artifact_canonical_sha256"]
        for key in ["summary", "cutoffs"]:
            pd.testing.assert_frame_equal(pd.DataFrame(output[key]), pd.DataFrame(expected[key]), check_exact=False, rtol=1e-9, atol=1e-10)
        pd.testing.assert_frame_equal(pd.DataFrame(selections), pd.read_csv(OUTPUT / "selections.csv"), check_exact=False, rtol=1e-9, atol=1e-10)
        print("BENCHMARK PASS: temporal guards, future-outcome isolation, results and selected IDs reproduced.")
    else:
        OUTPUT.mkdir(exist_ok=True)
        (OUTPUT / "summary.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        pd.DataFrame(selections).to_csv(OUTPUT / "selections.csv", index=False, lineterminator="\n")
    assert builder.OUTPUT.read_bytes() == artifact, "Production artifact must remain unchanged"
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

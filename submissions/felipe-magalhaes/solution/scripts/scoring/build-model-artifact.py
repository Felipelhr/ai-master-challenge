"""Reproduce the validated V1 training and freeze inference inputs for Next.js.

Run from the repository root with pandas, numpy, scikit-learn and joblib installed:
    python scripts/scoring/build-model-artifact.py

The training rows, preprocessing, classifier and fallback formula mirror the
read-only G4-003 solution/scoring/model.py. No Python runs in the web app.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy
import pandas as pd
import scipy
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
OUTPUT = ROOT / "src" / "domain" / "scoring" / "model-artifact.json"
AS_OF_DATE = "2017-12-31"
MAX_AGE = 138
AGE_EDGES = [0, 16, 46, 91, 121, 139]
AGE_LABELS = ["0-15", "16-45", "46-90", "91-120", "121-138"]
NUMERIC = ["age_days", "revenue", "employees", "company_age"]
CATEGORICAL = ["age_band", "product", "sector", "is_subsidiary"]
DATA_FILES = ["accounts.csv", "products.csv", "sales_pipeline.csv", "sales_teams.csv"]


def age_band(age: int) -> str:
    for lower, upper, label in zip(AGE_EDGES[:-1], AGE_EDGES[1:], AGE_LABELS):
        if lower <= age < upper:
            return label
    raise ValueError(f"Age {age} is outside model coverage")


def load_data() -> pd.DataFrame:
    pipeline = pd.read_csv(DATA / "sales_pipeline.csv")
    pipeline["product"] = pipeline["product"].replace({"GTXPro": "GTX Pro"})
    products = pd.read_csv(DATA / "products.csv")
    accounts = pd.read_csv(DATA / "accounts.csv")
    teams = pd.read_csv(DATA / "sales_teams.csv")
    frame = pipeline.merge(products[["product", "sales_price"]], on="product", how="left", validate="many_to_one")
    frame = frame.merge(accounts, on="account", how="left", validate="many_to_one")
    frame = frame.merge(teams, on="sales_agent", how="left", validate="many_to_one")
    if len(frame) != len(pipeline) or frame["sales_price"].isna().any() or frame["manager"].isna().any():
        raise ValueError("Data join lost rows or failed to match product/seller")
    frame["engage_date"] = pd.to_datetime(frame["engage_date"], errors="coerce")
    frame["close_date"] = pd.to_datetime(frame["close_date"], errors="coerce")
    return frame


def feature_rows(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["age_band"] = out["age_days"].astype(int).map(age_band)
    out["company_age"] = out["as_of_date"].dt.year - pd.to_numeric(out["year_established"], errors="coerce")
    out["is_subsidiary"] = out["subsidiary_of"].notna().map({True: "yes", False: "no"})
    return out[NUMERIC + CATEGORICAL]


def make_training_rows(data: pd.DataFrame) -> pd.DataFrame:
    cuts = pd.date_range("2017-03-31", "2017-11-30", freq="ME")
    rows = []
    for cut in cuts:
        age = (cut - data["engage_date"]).dt.days
        active = data["engage_date"].notna() & age.between(0, MAX_AGE) & data["account"].notna()
        active &= data["close_date"].isna() | (data["close_date"] > cut)
        part = data.loc[active].copy()
        part["age_days"] = age.loc[active].astype(int)
        part["as_of_date"] = cut
        part["target"] = ((part["deal_stage"] == "Won") & part["close_date"].between(cut + pd.Timedelta(days=1), cut + pd.Timedelta(days=30))).astype(int)
        rows.append(part)
    return pd.concat(rows, ignore_index=True)


def build() -> dict:
    data = load_data()
    training = make_training_rows(data)
    pre = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), NUMERIC),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), CATEGORICAL),
    ])
    model = Pipeline([("preprocess", pre), ("classifier", LogisticRegression(penalty="l2", max_iter=1000))])
    model.fit(feature_rows(training), training["target"])

    global_rate = float(training["target"].mean())
    bands = training.assign(age_band=training["age_days"].map(age_band)).groupby("age_band", observed=True)["target"].agg(["sum", "count"])
    fallback = {label: float((bands.loc[label, "sum"] + 20 * global_rate) / (bands.loc[label, "count"] + 20)) if label in bands.index else global_rate for label in AGE_LABELS}

    cut = pd.Timestamp(AS_OF_DATE)
    open_deals = data[data["deal_stage"].isin(["Engaging", "Prospecting"])].copy()
    open_deals["as_of_date"] = cut
    open_deals["age_days"] = (cut - open_deals["engage_date"]).dt.days
    covered = open_deals["deal_stage"].eq("Engaging") & open_deals["age_days"].between(0, MAX_AGE)
    known = open_deals["account"].notna() & open_deals["account"].astype(str).str.strip().ne("")
    full = covered & known
    propensity = pd.Series(index=open_deals.index, dtype=float)
    propensity.loc[full] = model.predict_proba(feature_rows(open_deals.loc[full]))[:, 1]
    propensity.loc[covered & ~known] = open_deals.loc[covered & ~known, "age_days"].astype(int).map(age_band).map(fallback)
    priority_value = propensity.loc[covered] * open_deals.loc[covered, "sales_price"]
    out_of_coverage = open_deals["deal_stage"].eq("Engaging") & ~covered
    prospecting = open_deals["deal_stage"].eq("Prospecting")

    num = model.named_steps["preprocess"].named_transformers_["num"]
    cat = model.named_steps["preprocess"].named_transformers_["cat"]
    classifier = model.named_steps["classifier"]
    digest = hashlib.sha256()
    for filename in DATA_FILES:
        digest.update(filename.encode("utf-8"))
        digest.update((DATA / filename).read_bytes())

    return {
        "version": "1.0.0",
        "asOfDate": AS_OF_DATE,
        "maxAge": MAX_AGE,
        "ageEdges": AGE_EDGES,
        "ageLabels": AGE_LABELS,
        "trainingRows": len(training),
        "trainingCutoffs": [str(x.date()) for x in pd.date_range("2017-03-31", "2017-11-30", freq="ME")],
        "datasetSha256": digest.hexdigest(),
        "trainingLibraries": {
            "python": sys.version.split()[0], "numpy": numpy.__version__, "pandas": pd.__version__,
            "scipy": scipy.__version__, "scikitLearn": sklearn.__version__,
        },
        "numericFeatures": NUMERIC,
        "categoricalFeatures": CATEGORICAL,
        "numericMedian": num.named_steps["impute"].statistics_.tolist(),
        "numericMean": num.named_steps["scale"].mean_.tolist(),
        "numericScale": num.named_steps["scale"].scale_.tolist(),
        "categoricalImpute": cat.named_steps["impute"].statistics_.tolist(),
        "categoricalValues": [values.tolist() for values in cat.named_steps["onehot"].categories_],
        "coefficients": classifier.coef_[0].tolist(),
        "intercept": float(classifier.intercept_[0]),
        "globalRate": global_rate,
        "fallback": fallback,
        "reference": {
            "coveredPriorityValue": sorted(priority_value.tolist()),
            "outOfCoveragePrice": sorted(open_deals.loc[out_of_coverage, "sales_price"].astype(float).tolist()),
            "prospectingPrice": sorted(open_deals.loc[prospecting, "sales_price"].astype(float).tolist()),
        },
    }


if __name__ == "__main__":
    artifact = build()
    OUTPUT.write_text(json.dumps(artifact, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} ({artifact['trainingRows']} training rows)")

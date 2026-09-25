from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .rules import AGE_LABELS, MAX_AGE, VERSION, age_band

BASE = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE / "models" / "model.joblib"
CONFIG_PATH = BASE / "models" / "config.json"
NUMERIC = ["age_days", "revenue", "employees", "company_age"]
CATEGORICAL = ["age_band", "product", "sector", "is_subsidiary"]


def load_data() -> pd.DataFrame:
    data = BASE / "data"
    pipeline = pd.read_csv(data / "sales_pipeline.csv")
    pipeline["product"] = pipeline["product"].replace({"GTXPro": "GTX Pro"})
    products = pd.read_csv(data / "products.csv")
    accounts = pd.read_csv(data / "accounts.csv")
    teams = pd.read_csv(data / "sales_teams.csv")
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
    # Complete 30-day labels only; no post-cutoff attributes enter the predictors.
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


def train() -> dict:
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
    config = {"version": VERSION, "as_of_date": "2017-12-31", "max_age": MAX_AGE, "age_labels": AGE_LABELS, "fallback": fallback, "global_rate": global_rate, "training_rows": len(training), "training_cutoffs": [str(x.date()) for x in pd.date_range("2017-03-31", "2017-11-30", freq="ME")]}
    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config


def load_artifacts():
    return joblib.load(MODEL_PATH), json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

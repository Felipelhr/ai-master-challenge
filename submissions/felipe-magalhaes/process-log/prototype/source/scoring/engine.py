from __future__ import annotations

import numpy as np
import pandas as pd

from .model import feature_rows, load_artifacts, load_data
from .rules import MAX_AGE, age_band


def _rank(values: pd.Series) -> pd.Series:
    return (values.rank(method="average", pct=True) * 100).round().astype(int)


def _route(row: pd.Series, fallback: dict) -> pd.Series:
    stage = row["deal_stage"]
    age = row["age_days"]
    known = pd.notna(row.get("account")) and str(row.get("account")).strip() != ""
    tags = []
    propensity = np.nan
    priority_value = np.nan
    price = float(row["sales_price"])
    if stage == "Prospecting":
        basis, confidence, action = "PROSPECTING_VALUE", "LOW", "ACTION_QUALIFY_PROSPECTING"
        tags.append("PROSPECTING_NO_ENGAGE_DATE")
        reason = f"Produto de US$ {price:,.0f}. Sem entrada em Engaging; score econômico relativo na fila de qualificação, sem probabilidade temporal."
        next_action = "Qualificar necessidade, contato e prazo."
        limitation = "Não há engage_date nem estimativa de fechamento."
    elif stage == "Engaging" and pd.notna(age) and age > MAX_AGE:
        basis, confidence, action = "OUT_OF_COVERAGE_VALUE", "LOW", "ACTION_LAST_CONTACT_BEFORE_FREEZE"
        tags.append("OUT_OF_COVERAGE_AGE")
        reason = f"Aberta há {int(age)} dias, além dos {MAX_AGE} dias observados nos negócios encerrados. Isso não prova perda. Score econômico relativo na fila de revalidação (US$ {price:,.0f})."
        next_action = "Fazer contato de revalidação antes de considerar congelamento."
        limitation = "Sem evidência suficiente para estimar propensão com segurança."
    elif stage == "Engaging" and pd.notna(age) and 0 <= age <= MAX_AGE:
        if known:
            basis, confidence, action = "MODEL_FULL", "MEDIUM", "ACTION_WORK_NOW"
            tags.append("MODEL_FULL")
            propensity = float(row["_model_propensity"])
        else:
            basis, confidence, action = "AGE_ONLY_FALLBACK", "LOW", "ACTION_ENRICH_ACCOUNT"
            tags.extend(["ACCOUNT_MISSING", "AGE_ONLY_FALLBACK"])
            propensity = float(fallback[age_band(int(age))])
        priority_value = propensity * price
        if age >= 121:
            tags.append("LOW_SUPPORT_AGE_121_138")
        reason = f"Aberta há {int(age)} dias. Produto de US$ {price:,.0f}; estimativa de vitória nos próximos 30 dias: {propensity:.1%}; valor ponderado: US$ {priority_value:,.0f}."
        if known:
            next_action = "Priorizar contato comercial agora."
            limitation = "Estimativa histórica moderada; não é garantia de fechamento."
        else:
            next_action = "Enriquecer a conta e validar os dados antes do contato."
            limitation = "Fallback usa apenas idade; ausência de conta não reduz diretamente a estimativa."
    else:
        raise ValueError(f"Unscoreable opportunity {row.get('opportunity_id')}: stage={stage}, age={age}")
    return pd.Series({"Score Basis": basis, "Confidence": confidence, "Action Tag": action, "Auxiliary Tags": tags, "propensity_30d": propensity, "priority_value": priority_value, "reason": reason, "next_action": next_action, "limitation": limitation})


def score(frame: pd.DataFrame, as_of_date="2017-12-31", artifacts=None, reference=None) -> pd.DataFrame:
    model, config = artifacts if artifacts is not None else load_artifacts()
    cut = pd.Timestamp(as_of_date)
    out = frame.copy().reset_index(drop=True)
    out["as_of_date"] = cut
    out["engage_date"] = pd.to_datetime(out["engage_date"], errors="coerce")
    out["age_days"] = (cut - out["engage_date"]).dt.days
    out["_model_propensity"] = np.nan
    known = out["account"].notna() & out["account"].astype(str).str.strip().ne("")
    covered = out["deal_stage"].eq("Engaging") & out["age_days"].between(0, MAX_AGE)
    full = covered & known
    if full.any():
        out.loc[full, "_model_propensity"] = model.predict_proba(feature_rows(out.loc[full]))[:, 1]
    scored = out.apply(lambda row: _route(row, config["fallback"]), axis=1)
    out = pd.concat([out.drop(columns="_model_propensity"), scored], axis=1)
    if reference is None:
        covered_mask = out["Score Basis"].isin(["MODEL_FULL", "AGE_ONLY_FALLBACK"])
        out.loc[covered_mask, "Priority Score"] = _rank(out.loc[covered_mask, "priority_value"])
        for basis in ("OUT_OF_COVERAGE_VALUE", "PROSPECTING_VALUE"):
            mask = out["Score Basis"].eq(basis)
            if mask.any():
                out.loc[mask, "Priority Score"] = _rank(out.loc[mask, "sales_price"])
    else:
        covered_values = reference.loc[reference["Score Basis"].isin(["MODEL_FULL", "AGE_ONLY_FALLBACK"]), "priority_value"].dropna().to_numpy()
        for idx, row in out.iterrows():
            ref = covered_values if row["Score Basis"] in ("MODEL_FULL", "AGE_ONLY_FALLBACK") else reference.loc[reference["Score Basis"].eq(row["Score Basis"]), "sales_price"].to_numpy()
            value = row["priority_value"] if row["Score Basis"] in ("MODEL_FULL", "AGE_ONLY_FALLBACK") else row["sales_price"]
            out.at[idx, "Priority Score"] = int(round(100 * ((ref < value).sum() + 0.5 * (ref == value).sum()) / len(ref))) if len(ref) else 50
    out["Priority Score"] = out["Priority Score"].astype(int)
    out = out.sort_values(["sales_agent", "Priority Score", "priority_value", "sales_price", "opportunity_id"], ascending=[True, False, False, False, True], na_position="last")
    eligible = out["Score Basis"].isin(["MODEL_FULL", "AGE_ONLY_FALLBACK"])
    if reference is None:
        top_ids = out.loc[eligible].groupby("sales_agent", sort=False).head(5).index
    else:
        top_ids = []
        for idx, row in out.loc[eligible].iterrows():
            peers = reference.loc[(reference["sales_agent"] == row["sales_agent"]) & reference["Score Basis"].isin(["MODEL_FULL", "AGE_ONLY_FALLBACK"]), "priority_value"]
            if (peers > row["priority_value"]).sum() < 5:
                top_ids.append(idx)
    for idx in top_ids:
        out.at[idx, "Auxiliary Tags"] = out.at[idx, "Auxiliary Tags"] + ["TOP_5_SELLER"]
        if out.at[idx, "Score Basis"] == "MODEL_FULL":
            out.at[idx, "Auxiliary Tags"] = out.at[idx, "Auxiliary Tags"] + ["FOLLOWUP_AUTOMATIZADO"]
    return out.sort_values(["Priority Score", "priority_value", "sales_price"], ascending=False, na_position="last").reset_index(drop=True)


def score_snapshot(as_of_date="2017-12-31") -> pd.DataFrame:
    data = load_data()
    return score(data[data["deal_stage"].isin(["Engaging", "Prospecting"])], as_of_date)


def score_new_opportunity(values: dict, reference: pd.DataFrame, as_of_date="2017-12-31") -> pd.DataFrame:
    row = pd.DataFrame([values])
    if row["product"].iat[0] == "GTXPro":
        row["product"] = "GTX Pro"
    products = pd.read_csv(__import__("pathlib").Path(__file__).resolve().parents[1] / "data" / "products.csv")
    row = row.merge(products[["product", "sales_price"]], on="product", how="left", validate="many_to_one")
    if row["sales_price"].isna().any():
        raise ValueError("Unknown product")
    return score(row, as_of_date=as_of_date, reference=reference)

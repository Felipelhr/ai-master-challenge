import pandas as pd

from labels import label, labels


G4_THEME_CSS = """
<style>
:root {
  --g4-navy-950: #061525;
  --g4-navy-900: #0a2038;
  --g4-navy-800: #123451;
  --g4-gold-500: #d5a640;
  --g4-gold-300: #edcd82;
  --g4-white: #ffffff;
  --g4-neutral-100: #eef2f5;
  --g4-neutral-500: #83909c;
  --g4-success: #2f9e68;
  --g4-danger: #c94b57;
}
[data-testid="stAppViewContainer"], [data-testid="stHeader"] { background: var(--g4-navy-950); }
[data-testid="stToolbar"], [data-testid="stStatusWidget"], #MainMenu { display: none !important; }
[data-testid="stSidebar"] { background: var(--g4-navy-900); }
[data-testid="stTabs"] [role="tab"][aria-selected="true"] { color: var(--g4-gold-300); }
[data-testid="stMetricValue"], .g4-score { color: var(--g4-gold-300); }
.g4-action { color: var(--g4-gold-300); font-weight: 700; }
.g4-reason { color: var(--g4-neutral-100); }
[data-testid="stPopover"] > button { min-height: 2.25rem; padding: .35rem .7rem; font-size: .78rem; white-space: nowrap; }
.score-basis-value { font-size: clamp(1rem, 1.55vw, 1.55rem); font-weight: 500; line-height: 1.15; overflow-wrap: anywhere; margin-bottom: .75rem; }
</style>
"""


def priority_reason_short(row):
    """Short operational explanation derived from existing scoring outputs."""
    basis = row.get("Score Basis")
    age = row.get("age_days")
    price = row.get("sales_price")
    if basis == "MODEL_FULL":
        age_text = f"há {int(age)} dias" if pd.notna(age) else "com histórico aplicável"
        return f"Em negociação {age_text}, com sinal histórico nos próximos 30 dias e impacto econômico de US$ {price:,.0f}."
    if basis == "AGE_ONLY_FALLBACK":
        return "Conta incompleta; prioridade calculada pelo histórico da faixa de idade e valor econômico."
    if basis == "OUT_OF_COVERAGE_VALUE":
        return "Fora da cobertura histórica; prioridade baseada no impacto econômico e necessidade de revalidação."
    if basis == "PROSPECTING_VALUE":
        return "Em prospecção; prioridade baseada no potencial econômico e necessidade de qualificação."
    reason = str(row.get("reason") or "")
    return reason.split(".")[0] + ("." if reason else "")


def next_task_summary(row):
    title = row.get("next_task")
    if pd.isna(title):
        return "Sem tarefa pendente"
    due = row.get("next_task_due")
    due_text = "Sem data" if pd.isna(due) or not due else pd.to_datetime(due).strftime("%d/%m/%Y")
    return f"{title} · {due_text}"


def enrich_operational(frame, tasks, user_tags):
    out = frame.copy()
    tags_by_deal = user_tags.groupby("opportunity_id")["tag"].apply(list).to_dict() if not user_tags.empty else {}
    out["System Tags"] = out.apply(lambda row: ([row["Action Tag"]] if row["Action Tag"] != "Encerrada" else []) + list(row["Auxiliary Tags"]), axis=1)
    out["User Tags"] = out["opportunity_id"].map(lambda oid: tags_by_deal.get(oid, []))
    pending = tasks[tasks["status"] == "PENDING"] if not tasks.empty else tasks
    count = pending.groupby("opportunity_id").size().to_dict() if not pending.empty else {}
    if pending.empty:
        nxt = pd.DataFrame(columns=["title", "description", "due_date"])
    else:
        ordered = pending.assign(_sort_due=pending["due_date"].fillna("9999-12-31"))
        nxt = ordered.sort_values(["_sort_due", "created_at", "task_id"]).drop_duplicates("opportunity_id").set_index("opportunity_id")
    out["next_task"] = out["opportunity_id"].map(nxt["title"])
    out["next_task_description"] = out["opportunity_id"].map(nxt["description"])
    out["next_task_due"] = out["opportunity_id"].map(nxt["due_date"])
    out["pending_task_count"] = out["opportunity_id"].map(lambda oid: count.get(oid, 0))
    return out


def kanban_order(frame):
    out = frame.copy()
    out["_due"] = out["next_task_due"].fillna("9999-12-31")
    return out.sort_values(["Priority Score", "_due", "opportunity_id"], ascending=[False, True, True], na_position="last").drop(columns="_due")


def filter_table(frame, choices):
    out = frame.copy()
    for col, selected in choices.items():
        if selected:
            if col in ("Auxiliary Tags", "System Tags", "User Tags"):
                out = out[out[col].map(lambda tags: any(x in tags for x in selected))]
            else:
                out = out[out[col].isin(selected)]
    return out


def export_visible(frame):
    cols = {"opportunity_id": "opportunity_id", "sales_agent": "seller", "manager": "manager", "regional_office": "regional_office", "account": "account", "product": "product", "sales_price": "sales_price", "deal_stage": "stage_code", "age_days": "age_days", "Priority Score": "priority_score", "Score Basis": "score_basis_code", "Confidence": "confidence_code", "Action Tag": "action_tag_code", "System Tags": "system_tags_codes", "User Tags": "user_tags", "propensity_30d": "propensity_30d", "priority_value": "priority_value", "reason": "reason", "next_action": "next_action", "next_task": "próxima tarefa", "next_task_due": "vencimento", "pending_task_count": "quantidade de tarefas pendentes", "limitation": "limitation"}
    result = frame[list(cols)].rename(columns=cols).copy()
    result["stage"] = result["stage_code"].map(label)
    result["score_basis"] = result["score_basis_code"].map(label)
    result["confidence"] = result["confidence_code"].map(label)
    result["action_tag"] = result["action_tag_code"].map(label)
    result["system_tags"] = result["system_tags_codes"].map(lambda x: " | ".join(labels(x)))
    result["system_tags_codes"] = result["system_tags_codes"].map(lambda x: " | ".join(x))
    result["user_tags"] = result["user_tags"].map(lambda x: " | ".join(x))
    return result.to_csv(index=False).encode("utf-8-sig")

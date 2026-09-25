from __future__ import annotations

from html import escape

import pandas as pd

from labels import label
from ui import next_task_summary, priority_reason_short


def generate_priority_digest(frame: pd.DataFrame, limit: int = 5) -> dict:
    """Build an email-ready digest from scores already present in the filtered frame."""
    ranked = frame.sort_values(
        ["Priority Score", "opportunity_id"], ascending=[False, True], na_position="last"
    ).head(limit)
    items = []
    for _, row in ranked.iterrows():
        account = row["account"] if pd.notna(row.get("account")) else "Conta não identificada"
        items.append(
            {
                "opportunity": str(row["opportunity_id"]),
                "account": str(account),
                "score": int(row["Priority Score"]) if pd.notna(row["Priority Score"]) else None,
                "confidence": label(row["Confidence"]),
                "reason": priority_reason_short(row),
                "action": label(row["Action Tag"]),
                "next_task": next_task_summary(row),
                "value": f"US$ {row['sales_price']:,.0f}",
            }
        )

    subject = "Top prioridades comerciais"
    text_lines = [subject, "", "Onde focar, por que e o que fazer:"]
    html_items = []
    for index, item in enumerate(items, 1):
        score = item["score"] if item["score"] is not None else "—"
        text_lines.extend(
            [
                "",
                f"{index}. {item['account']} · {item['opportunity']} · Score {score}/100",
                f"Confiança: {item['confidence']} · Valor: {item['value']}",
                f"Por que: {item['reason']}",
                f"O que fazer: {item['action']}",
                f"Próxima tarefa: {item['next_task']}",
            ]
        )
        html_items.append(
            "<li style='margin-bottom:20px'>"
            f"<strong>{escape(item['account'])} · {escape(item['opportunity'])}</strong> "
            f"<span>— Score {escape(str(score))}/100</span><br>"
            f"Confiança: {escape(item['confidence'])} · Valor: {escape(item['value'])}<br>"
            f"<strong>Por que:</strong> {escape(item['reason'])}<br>"
            f"<strong>O que fazer:</strong> {escape(item['action'])}<br>"
            f"<strong>Próxima tarefa:</strong> {escape(item['next_task'])}</li>"
        )

    if not items:
        text_lines.extend(["", "Nenhuma oportunidade disponível no filtro atual."])
        html_items.append("<li>Nenhuma oportunidade disponível no filtro atual.</li>")
    html = (
        "<div style='font-family:Arial,sans-serif;color:#0a2038'>"
        f"<h2>{escape(subject)}</h2><p>Onde focar, por que e o que fazer:</p>"
        f"<ol>{''.join(html_items)}</ol></div>"
    )
    return {"subject": subject, "text": "\n".join(text_lines), "html": html, "items": items}

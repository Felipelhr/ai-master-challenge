from __future__ import annotations

import os
import time
from datetime import date
from io import BytesIO
from pathlib import Path

TEST_DB = Path(__file__).resolve().parent / "ux_test.db"
os.environ["LEAD_CRM_DB_PATH"] = str(TEST_DB)

import pandas as pd
from streamlit.testing.v1 import AppTest

import crm_state as state
from labels import label
from scoring.engine import score_snapshot
from ui import G4_THEME_CSS, enrich_operational, export_visible, filter_table, kanban_order, next_task_summary, priority_reason_short


def test_pipeline_ui():
    TEST_DB.unlink(missing_ok=True)
    try:
        baseline = score_snapshot()
        assert len(baseline) == 2089
        assert baseline["Score Basis"].value_counts().to_dict() == {"OUT_OF_COVERAGE_VALUE": 1291, "PROSPECTING_VALUE": 500, "AGE_ONLY_FALLBACK": 209, "MODEL_FULL": 89}
        oid = baseline.iloc[0]["opportunity_id"]
        state.create_task(oid, "Ligar para a conta", due_date=date.today())
        state.add_tag(oid, "VIP")
        started = time.perf_counter()
        frame = enrich_operational(baseline, state.list_tasks(), state.list_tags())
        assert time.perf_counter() - started < 0.5
        confidence_counts = frame["Confidence"].map(label).value_counts()
        assert set(confidence_counts.index) == {"Baixa", "Média"}
        assert int(confidence_counts.sum()) == len(frame)
        row = frame[frame["opportunity_id"] == oid].iloc[0]
        assert 20 < len(priority_reason_short(row)) < 180
        assert "Ligar para a conta" in next_task_summary(row)
        assert row["next_task"] == "Ligar para a conta"
        assert row["User Tags"] == ["VIP"]
        visible = filter_table(frame, {"Action Tag": [row["Action Tag"]], "User Tags": ["VIP"]})
        assert visible["opportunity_id"].tolist() == [oid]
        csv = pd.read_csv(BytesIO(export_visible(visible)))
        assert csv["opportunity_id"].tolist() == [oid]
        assert csv.iloc[0]["action_tag_code"] == row["Action Tag"]
        assert csv.iloc[0]["action_tag"] == label(row["Action Tag"])
        assert csv.iloc[0]["próxima tarefa"] == "Ligar para a conta"
        ordered = kanban_order(frame[frame["deal_stage"] == "Engaging"])
        assert ordered["Priority Score"].is_monotonic_decreasing

        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=120).run()
        assert not app.exception, [x.message for x in app.exception]
        assert [x.label for x in app.tabs] == ["Lista", "Pipeline", "Pontuar Nova Oportunidade", "Como funciona", "Dashboard"]
        assert not any(x.key in ("f_stage", "f_followup") for x in app.sidebar.selectbox)
        assert not any(x.key == "f_stage" for x in app.sidebar.multiselect)
        assert [x.label for x in app.sidebar.multiselect] == ["Tags Auxiliares", "Ação Recomendada", "Confiança", "Vendedor", "Manager", "Região", "Produto", "Setor", "Critérios de Score"]
        list_headers = ["Oportunidade", "Score de Prioridade", "O que fazer", "Por que priorizar", "Próxima tarefa", "Confiança"]
        rendered = [x.value for x in app.markdown]
        assert all(any(header in value for value in rendered) for header in list_headers)
        assert any("g4-score" in value for value in rendered)
        assert any("g4-action" in value for value in rendered)
        assert any("g4-reason" in value for value in rendered)
        assert "ACTION_WORK_NOW" not in " ".join(rendered)
        assert "--g4-navy-950" in G4_THEME_CSS and "--g4-gold-500" in G4_THEME_CSS
        assert "Follow-up automatizado" in app.sidebar.multiselect[0].options
        assert any("PROSPECÇÃO" in x.value for x in app.markdown)
        assert any("EM NEGOCIAÇÃO" in x.value for x in app.markdown)
        assert any("ABERTO" in str(x.options) for x in app.segmented_control)
        expected_lanes = {
            "ABERTO": ["PROSPECÇÃO", "EM NEGOCIAÇÃO"],
            "GANHO": ["GANHO"],
            "PERDIDO": ["PERDIDO"],
            "TODOS": ["PROSPECÇÃO", "EM NEGOCIAÇÃO", "GANHO", "PERDIDO"],
        }
        sequence = ["ABERTO", "GANHO", "PERDIDO", "TODOS", "ABERTO", "PERDIDO", "GANHO", "ABERTO"]
        for status in sequence:
            next(x for x in app.segmented_control if x.label == "Status").set_value(status).run()
            assert not app.exception, [x.message for x in app.exception]
            assert any(f"pipeline-mode-{status}" in x.value for x in app.markdown)
            assert [x.value.removeprefix("#### ") for x in app.markdown if x.value.startswith("#### ")] == expected_lanes["TODOS"]
        assert any(x.key.startswith("list_") for x in app.button)
        assert any(x.key.startswith("card_") for x in app.button)
        assert any("Quem fez o quê" in x.value for x in app.header)
        assert any("Como construímos" in x.value for x in app.header)
        first_list = next(x for x in app.button if x.key.startswith("list_"))
        first_list.click().run()
        assert not app.exception, [x.message for x in app.exception]
        assert any(x.label == "Área" for x in app.segmented_control)
        assert any("Próxima tarefa" in x.value for x in app.markdown)
        assert any(x.label.startswith("○ ") for x in app.expander)
        assert any(x.label == "+ Nova tarefa" for x in app.button)
        assert not any(x.label == "Criar tarefa" for x in app.button)
        assert not any(x.label in ("Próximo ▶", "◀ Anterior", "Mês atual") for x in app.button)
        next(x for x in app.button if x.key == first_list.key).click().run()
        assert not app.exception, [x.message for x in app.exception]
        assert any(x.label == "Área" for x in app.segmented_control)
        next(x for x in app.button if x.key.startswith("list_") and x.key != first_list.key).click().run()
        assert not app.exception, [x.message for x in app.exception]
        next(x for x in app.button if x.key.startswith("card_")).click().run()
        assert not app.exception, [x.message for x in app.exception]
        source = (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")
        about = (Path(__file__).resolve().parents[1] / "about.py").read_text(encoding="utf-8")
        assert "Confiança do Score — oportunidades abertas" in source
        assert "visible[\"Confidence\"]" in source
        assert "Distribuição do Score de Prioridade" not in source
        assert "st.code" not in source and "st.code" not in (Path(__file__).resolve().parents[1] / "crm_views.py").read_text(encoding="utf-8")
        assert "contribution.split" not in about
        assert "As decisões finais de lógica de negócio e produto foram humanas." in about
        assert "hipóteses a serem confrontadas, não como conclusões automáticas" in about
        assert "Samantha (Sam Agent)" in about and "Jarvis" in about
        assert score_snapshot()["Priority Score"].equals(baseline["Priority Score"])
    finally:
        TEST_DB.unlink(missing_ok=True)


if __name__ == "__main__":
    test_pipeline_ui()
    print("TEST 2 PIPELINE UX PASS")

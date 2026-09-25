from pathlib import Path

import pandas as pd

import crm_state as state
from scoring.engine import score_snapshot
from ui import enrich_operational


def test_crm_state():
    path = Path(__file__).resolve().parent / "crm_test.db"
    try:
        path.unlink(missing_ok=True)
        oid = score_snapshot().iloc[0]["opportunity_id"]
        state.ensure_initial_tasks(score_snapshot(), path)
        seeded = state.list_tasks(path)
        assert len(seeded) > 0
        assert set(seeded["source"]) == {"SYSTEM_ACTION"}
        initial_count = len(seeded)
        state.ensure_initial_tasks(score_snapshot(), path)
        assert len(state.list_tasks(path)) == initial_count
        initial_id = seeded[seeded["opportunity_id"] == oid].iloc[0]["task_id"]
        state.delete_task(initial_id, path)
        state.ensure_initial_tasks(score_snapshot(), path)
        assert len(state.list_tasks(path)) == initial_count - 1
        state.add_tag(oid, "Revisar", path)
        assert "Revisar" in state.list_tags(path)["tag"].tolist()
        state.rename_tag(oid, "Revisar", "VIP", path)
        assert state.list_tags(path)["tag"].tolist() == ["VIP"]
        task_id = state.create_task(oid, "Ligar", due_date="2026-10-01", path=path)
        state.update_task(task_id, "Ligar hoje", "Teste", "2026-09-25", path)
        state.create_task(oid, "Depois", due_date="2026-10-02", path=path)
        assert state.next_task(state.list_tasks(path), oid)["title"] == "Ligar hoje"
        state.set_task_status(task_id, "COMPLETED", path)
        assert state.next_task(state.list_tasks(path), oid)["title"] == "Depois"
        state.set_task_status(task_id, "PENDING", path)
        assert state.next_task(state.list_tasks(path), oid)["title"] == "Ligar hoje"
        note_id = state.create_note(oid, "Contato realizado", path)
        assert state.list_notes(path).iloc[0]["content"] == "Contato realizado"
        state.update_note(note_id, "Contato reagendado", path)
        assert state.list_notes(path).iloc[0]["content"] == "Contato reagendado"
        before = score_snapshot().iloc[0]["Auxiliary Tags"]
        enriched = enrich_operational(score_snapshot(), state.list_tasks(path), state.list_tags(path))
        row = enriched[enriched["opportunity_id"] == oid].iloc[0]
        assert row["System Tags"] == [row["Action Tag"]] + before
        assert row["User Tags"] == ["VIP"]
        assert row["next_task"] == "Ligar hoje"
        stage_id = state.create_pipeline_stage("Validação técnica", path)
        assert state.list_pipeline_stages(path)[0]["name"] == "Validação técnica"
        state.set_opportunity_pipeline_stage(oid, stage_id, path)
        assert state.list_stage_overrides(path)[oid] == stage_id
        state.set_opportunity_pipeline_stage(oid, None, path)
        assert oid not in state.list_stage_overrides(path)
        created = score_snapshot().iloc[0].copy()
        created["opportunity_id"] = "NEW-TEST"
        state.create_user_opportunity(created, path)
        persisted = state.list_user_opportunities(path).iloc[0]
        assert persisted["opportunity_id"] == "NEW-TEST"
        assert persisted["Priority Score"] == created["Priority Score"]
        state.ensure_initial_tasks(pd.DataFrame([created]), path)
        assert "NEW-TEST" in state.list_tasks(path)["opportunity_id"].tolist()
        state.remove_tag(oid, "VIP", path)
        assert state.list_tags(path).empty
        state.delete_task(task_id, path)
        assert task_id not in state.list_tasks(path)["task_id"].tolist()
        state.delete_note(note_id, path)
        assert state.list_notes(path).empty
    finally:
        path.unlink(missing_ok=True)


if __name__ == "__main__":
    test_crm_state()
    print("TEST 1 CRM STATE PASS")

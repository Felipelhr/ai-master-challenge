from datetime import datetime, time, timezone
from pathlib import Path

import pandas as pd

import crm_state as state
from email_scheduler import process_due_schedules
from email_schedules import (
    TIMEZONE,
    calculate_next_run,
    list_schedules,
    list_send_log,
    save_schedule,
    set_schedule_enabled,
    snapshot_digest_rows,
)
from email_service import EmailService


def frame():
    return pd.DataFrame(
        [
            {
                "opportunity_id": f"OP-{index}", "account": f"Conta {index}",
                "Priority Score": score, "Confidence": "MEDIUM", "Score Basis": "MODEL_FULL",
                "age_days": index + 20, "sales_price": index * 1000, "Action Tag": "ACTION_WORK_NOW",
                "next_task": "Fazer contato", "next_task_due": pd.NaT, "reason": "Razão",
                "deal_stage": "Engaging", "sales_agent": "Vendedor A", "manager": "Manager A",
                "regional_office": "East", "product": "GTX Pro", "sector": "Tech",
                "System Tags": ["ACTION_WORK_NOW"], "User Tags": [],
            }
            for index, score in enumerate([70, 99, 85, 91, 60, 95], 1)
        ]
    )


def test_db(name):
    path = Path(__file__).resolve().parents[1] / ".tmp" / name
    path.parent.mkdir(exist_ok=True)
    path.unlink(missing_ok=True)
    return path


def test_scheduling():
    now = datetime(2026, 9, 24, 14, 0, tzinfo=timezone.utc)
    daily = calculate_next_run("DAILY", time(8), now)
    weekly = calculate_next_run("WEEKLY", time(8), now, weekday=0)
    monthly = calculate_next_run("MONTHLY", time(8), datetime(2027, 2, 1, tzinfo=timezone.utc), day_of_month=31)
    assert str(daily.astimezone().tzinfo) is not None
    assert daily.astimezone(__import__("zoneinfo").ZoneInfo(TIMEZONE)).hour == 8
    assert weekly.astimezone(__import__("zoneinfo").ZoneInfo(TIMEZONE)).weekday() == 0
    assert monthly.astimezone(__import__("zoneinfo").ZoneInfo(TIMEZONE)).day == 28
    path = test_db("schedule_calculation.db")
    schedule_id = save_schedule("a@example.com", "DAILY", time(8), {"choices": {}}, path=path, now=now)
    save_schedule("b@example.com", "WEEKLY", time(9), {"choices": {"sales_agent": ["Vendedor A"]}}, weekday=2, schedule_id=schedule_id, path=path, now=now)
    saved = list_schedules(path)[0]
    assert saved["recipient_email"] == "b@example.com" and saved["weekday"] == 2
    set_schedule_enabled(schedule_id, False, path)
    assert list_schedules(path)[0]["enabled"] == 0
    set_schedule_enabled(schedule_id, True, path)
    assert list_schedules(path)[0]["enabled"] == 1


def test_execution():
    class MockTransport:
        def __init__(self):
            self.calls = []

        def send(self, api_key, payload):
            self.calls.append(payload)
            if payload["to"] == ["fail@example.com"]:
                raise RuntimeError("provider unavailable")
            return {"id": f"mock-{len(self.calls)}"}

    now = datetime(2026, 9, 24, 14, 0, tzinfo=timezone.utc)
    path = test_db("schedule_execution.db")
    scope = {
        "score": [0, 100], "choices": {"sales_agent": ["Vendedor A"]},
        "digest_rows": snapshot_digest_rows(frame()),
    }
    ok_id = save_schedule("ok@example.com", "DAILY", time(8), scope, path=path, now=now)
    fail_id = save_schedule("fail@example.com", "DAILY", time(8), scope, path=path, now=now)
    due = datetime(2026, 9, 24, 13, 0, tzinfo=timezone.utc).isoformat(timespec="seconds")
    with state.db(path) as con:
        con.execute("UPDATE email_schedules SET next_run_at=? WHERE id IN (?,?)", (due, ok_id, fail_id))
    original_scores = frame()["Priority Score"].tolist()
    transport = MockTransport()
    service = EmailService(api_key="test", sender="digest@example.com", transport=transport)
    result = process_due_schedules(now, service, path=path)
    assert result == {"due": 2, "sent": 1, "failed": 1, "skipped": 0}
    logs = list_send_log(path)
    assert {row["status"] for row in logs} == {"SENT", "FAILED"}
    assert len(transport.calls) == 2
    assert all(call.get("_idempotency_key", "").startswith("schedule-") for call in transport.calls)
    retry = process_due_schedules(now, service, path=path)
    assert retry["sent"] == 0 and retry["failed"] == 1
    assert len([call for call in transport.calls if call["to"] == ["ok@example.com"]]) == 1
    assert frame()["Priority Score"].tolist() == original_scores
    manual = service.send_digest("manual@example.com", {"subject": "Manual", "html": "<p>x</p>", "text": "x"})
    assert manual["id"].startswith("mock-")
    unconfigured = process_due_schedules(now, EmailService(api_key="", sender="", transport=transport), path=path)
    assert unconfigured["sent"] == 0


if __name__ == "__main__":
    test_scheduling()
    print("TEST 1 SCHEDULING PASS")
    test_execution()
    print("TEST 2 EXECUTION PASS")

from __future__ import annotations

import calendar
import json
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pandas as pd

import crm_state as state
from ui import filter_table

TIMEZONE = "America/Sao_Paulo"
FREQUENCIES = {"DAILY", "WEEKLY", "MONTHLY"}
DIGEST_COLUMNS = [
    "opportunity_id", "account", "Priority Score", "Confidence", "Score Basis", "age_days",
    "sales_price", "Action Tag", "next_task", "next_task_due", "reason",
]


def _utc_now():
    return datetime.now(timezone.utc)


def _parse_time(value):
    return value if isinstance(value, time) else time.fromisoformat(str(value))


def calculate_next_run(frequency, send_time, now=None, weekday=None, day_of_month=None):
    if frequency not in FREQUENCIES:
        raise ValueError("Frequência inválida")
    zone = ZoneInfo(TIMEZONE)
    current = (now or _utc_now()).astimezone(zone)
    chosen_time = _parse_time(send_time)
    if frequency == "DAILY":
        candidate = datetime.combine(current.date(), chosen_time, zone)
        if candidate <= current:
            candidate += timedelta(days=1)
    elif frequency == "WEEKLY":
        if weekday is None or not 0 <= int(weekday) <= 6:
            raise ValueError("Dia da semana inválido")
        days = (int(weekday) - current.weekday()) % 7
        candidate = datetime.combine(current.date() + timedelta(days=days), chosen_time, zone)
        if candidate <= current:
            candidate += timedelta(days=7)
    else:
        if day_of_month is None or not 1 <= int(day_of_month) <= 31:
            raise ValueError("Dia do mês inválido")
        year, month = current.year, current.month
        day = min(int(day_of_month), calendar.monthrange(year, month)[1])
        candidate = datetime.combine(current.date().replace(day=day), chosen_time, zone)
        if candidate <= current:
            month = 1 if month == 12 else month + 1
            year = year + 1 if month == 1 else year
            day = min(int(day_of_month), calendar.monthrange(year, month)[1])
            candidate = datetime.combine(datetime(year, month, day).date(), chosen_time, zone)
    return candidate.astimezone(timezone.utc)


def ensure_schema(path=state.DB_PATH):
    with state.db(path) as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS email_schedules (
                id TEXT PRIMARY KEY,
                recipient_email TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                frequency TEXT NOT NULL CHECK(frequency IN ('DAILY','WEEKLY','MONTHLY')),
                send_time TEXT NOT NULL,
                weekday INTEGER,
                day_of_month INTEGER,
                timezone TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_sent_at TEXT,
                next_run_at TEXT NOT NULL,
                scope_config TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS email_send_log (
                schedule_id TEXT NOT NULL,
                scheduled_for TEXT NOT NULL,
                sent_at TEXT,
                recipient TEXT NOT NULL,
                status TEXT NOT NULL,
                provider_message_id TEXT,
                error TEXT,
                PRIMARY KEY (schedule_id, scheduled_for),
                FOREIGN KEY (schedule_id) REFERENCES email_schedules(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_email_schedules_due ON email_schedules(enabled, next_run_at);
        """)


def save_schedule(recipient, frequency, send_time, scope_config, weekday=None, day_of_month=None, schedule_id=None, path=state.DB_PATH, now=None):
    ensure_schema(path)
    recipient = recipient.strip()
    if "@" not in recipient:
        raise ValueError("Destinatário inválido")
    now_dt = now or _utc_now()
    next_run = calculate_next_run(frequency, send_time, now_dt, weekday, day_of_month)
    schedule_id = schedule_id or uuid.uuid4().hex
    stamp = now_dt.isoformat(timespec="seconds")
    with state.db(path) as con:
        existing = con.execute("SELECT created_at, last_sent_at, enabled FROM email_schedules WHERE id=?", (schedule_id,)).fetchone()
        con.execute(
            """INSERT OR REPLACE INTO email_schedules
            (id,recipient_email,enabled,frequency,send_time,weekday,day_of_month,timezone,created_at,updated_at,last_sent_at,next_run_at,scope_config)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                schedule_id, recipient, int(existing["enabled"] if existing else 1), frequency,
                _parse_time(send_time).strftime("%H:%M"), weekday if frequency == "WEEKLY" else None,
                day_of_month if frequency == "MONTHLY" else None, TIMEZONE,
                existing["created_at"] if existing else stamp, stamp,
                existing["last_sent_at"] if existing else None, next_run.isoformat(timespec="seconds"),
                json.dumps(scope_config, ensure_ascii=False, sort_keys=True),
            ),
        )
    return schedule_id


def list_schedules(path=state.DB_PATH):
    ensure_schema(path)
    with state.db(path) as con:
        rows = con.execute("SELECT * FROM email_schedules ORDER BY created_at DESC").fetchall()
    return [dict(row) | {"scope_config": json.loads(row["scope_config"])} for row in rows]


def set_schedule_enabled(schedule_id, enabled, path=state.DB_PATH, now=None):
    stamp = (now or _utc_now()).isoformat(timespec="seconds")
    with state.db(path) as con:
        con.execute("UPDATE email_schedules SET enabled=?, updated_at=? WHERE id=?", (int(enabled), stamp, schedule_id))


def delete_schedule(schedule_id, path=state.DB_PATH):
    with state.db(path) as con:
        con.execute("DELETE FROM email_schedules WHERE id=?", (schedule_id,))


def apply_scope(frame: pd.DataFrame, scope: dict) -> pd.DataFrame:
    choices = scope.get("choices", {})
    visible = filter_table(frame, choices)
    low, high = scope.get("score", [0, 100])
    visible = visible[visible["Priority Score"].between(low, high) | (((low, high) == (0, 100)) & visible["Priority Score"].isna())]
    missing = scope.get("missing", "Todos")
    if missing != "Todos":
        visible = visible[visible["account"].isna() == (missing == "Sim")]
    top5 = scope.get("top5", "Todos")
    if top5 != "Todos":
        visible = visible[visible["System Tags"].map(lambda tags: ("TOP_5_SELLER" in tags) == (top5 == "Sim"))]
    tags = scope.get("tags", [])
    if tags:
        visible = visible[visible.apply(lambda row: any(tag in row["System Tags"] + row["User Tags"] for tag in tags), axis=1)]
    return visible[visible["deal_stage"].isin(["Prospecting", "Engaging"])]


def snapshot_digest_rows(frame: pd.DataFrame) -> list[dict]:
    """Persist already-scored digest inputs so the worker never invokes scoring."""
    rows = []
    for record in frame[DIGEST_COLUMNS].to_dict("records"):
        rows.append(
            {
                key: (None if pd.isna(value) else value.item() if hasattr(value, "item") else str(value) if isinstance(value, (pd.Timestamp,)) else value)
                for key, value in record.items()
            }
        )
    return rows


def due_schedules(now=None, path=state.DB_PATH):
    ensure_schema(path)
    instant = (now or _utc_now()).isoformat(timespec="seconds")
    with state.db(path) as con:
        rows = con.execute("SELECT * FROM email_schedules WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at", (instant,)).fetchall()
    return [dict(row) | {"scope_config": json.loads(row["scope_config"])} for row in rows]


def reserve_execution(schedule, path=state.DB_PATH):
    with state.db(path) as con:
        inserted = con.execute(
            """INSERT OR IGNORE INTO email_send_log (schedule_id,scheduled_for,recipient,status)
            VALUES (?,?,?,'RUNNING')""",
            (schedule["id"], schedule["next_run_at"], schedule["recipient_email"]),
        )
        if inserted.rowcount == 1:
            return True
        retried = con.execute(
            """UPDATE email_send_log SET status='RUNNING', error=NULL
            WHERE schedule_id=? AND scheduled_for=? AND status='FAILED'""",
            (schedule["id"], schedule["next_run_at"]),
        )
        return retried.rowcount == 1


def finish_execution(schedule, result=None, error=None, now=None, path=state.DB_PATH):
    instant = now or _utc_now()
    with state.db(path) as con:
        if error is not None:
            con.execute(
                "UPDATE email_send_log SET status='FAILED', error=? WHERE schedule_id=? AND scheduled_for=?",
                (str(error), schedule["id"], schedule["next_run_at"]),
            )
            return
        sent_at = instant.isoformat(timespec="seconds")
        con.execute(
            """UPDATE email_send_log SET status='SENT', sent_at=?, provider_message_id=?, error=NULL
            WHERE schedule_id=? AND scheduled_for=?""",
            (sent_at, (result or {}).get("id"), schedule["id"], schedule["next_run_at"]),
        )
        next_run = calculate_next_run(
            schedule["frequency"], schedule["send_time"], instant,
            schedule["weekday"], schedule["day_of_month"],
        )
        con.execute(
            "UPDATE email_schedules SET last_sent_at=?, next_run_at=?, updated_at=? WHERE id=?",
            (sent_at, next_run.isoformat(timespec="seconds"), sent_at, schedule["id"]),
        )


def list_send_log(path=state.DB_PATH):
    ensure_schema(path)
    with state.db(path) as con:
        return [dict(row) for row in con.execute("SELECT * FROM email_send_log ORDER BY scheduled_for")]

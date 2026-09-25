"""User-created CRM state. The CSVs and frozen scoring artifacts remain authoritative."""
from __future__ import annotations

import sqlite3
import uuid
import os
import json
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

DB_PATH = Path(os.environ.get("LEAD_CRM_DB_PATH", Path(__file__).resolve().parent / "data" / "app_state.db"))


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path=DB_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript("""
        CREATE TABLE IF NOT EXISTS user_tags (
            opportunity_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (opportunity_id, tag)
        );
        CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            opportunity_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            due_date TEXT,
            status TEXT NOT NULL CHECK(status IN ('PENDING', 'COMPLETED')),
            created_at TEXT NOT NULL,
            completed_at TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_seed_state (
            opportunity_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_opportunity ON tasks(opportunity_id, status, due_date);
        CREATE TABLE IF NOT EXISTS opportunity_notes (
            note_id TEXT PRIMARY KEY,
            opportunity_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_opportunity ON opportunity_notes(opportunity_id, created_at);
        CREATE TABLE IF NOT EXISTS custom_pipeline_stages (
            stage_id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS opportunity_stage_overrides (
            opportunity_id TEXT PRIMARY KEY,
            stage_id TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (stage_id) REFERENCES custom_pipeline_stages(stage_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS user_opportunities (
            opportunity_id TEXT PRIMARY KEY,
            scored_payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    """)
    if "source" not in {row[1] for row in con.execute("PRAGMA table_info(tasks)")}:
        con.execute("ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'USER'")
    con.commit()
    return con


@contextmanager
def db(path=DB_PATH):
    con = connect(path)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def add_tag(opportunity_id, tag, path=DB_PATH):
    tag = tag.strip()
    if not tag:
        raise ValueError("Tag vazia")
    with db(path) as con:
        con.execute("INSERT OR IGNORE INTO user_tags VALUES (?, ?, ?)", (opportunity_id, tag, _now()))


def remove_tag(opportunity_id, tag, path=DB_PATH):
    with db(path) as con:
        con.execute("DELETE FROM user_tags WHERE opportunity_id=? AND tag=?", (opportunity_id, tag))


def rename_tag(opportunity_id, old, new, path=DB_PATH):
    new = new.strip()
    if not new:
        raise ValueError("Tag vazia")
    with db(path) as con:
        con.execute("DELETE FROM user_tags WHERE opportunity_id=? AND tag=?", (opportunity_id, old))
        con.execute("INSERT OR IGNORE INTO user_tags VALUES (?, ?, ?)", (opportunity_id, new, _now()))


def list_tags(path=DB_PATH):
    with db(path) as con:
        return pd.read_sql_query("SELECT opportunity_id, tag FROM user_tags ORDER BY tag", con)


def create_task(opportunity_id, title, description="", due_date=None, path=DB_PATH, source="USER"):
    title = title.strip()
    if not title:
        raise ValueError("Título da tarefa é obrigatório")
    task_id = uuid.uuid4().hex
    now = _now()
    due = str(due_date) if due_date else None
    with db(path) as con:
        con.execute("INSERT INTO tasks (task_id, opportunity_id, title, description, due_date, status, created_at, completed_at, updated_at, source) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, ?, ?)", (task_id, opportunity_id, title, description, due, now, now, source))
    return task_id


def update_task(task_id, title, description="", due_date=None, path=DB_PATH):
    title = title.strip()
    if not title:
        raise ValueError("Título da tarefa é obrigatório")
    with db(path) as con:
        con.execute("UPDATE tasks SET title=?, description=?, due_date=?, updated_at=? WHERE task_id=?", (title, description, str(due_date) if due_date else None, _now(), task_id))


def set_task_status(task_id, status, path=DB_PATH):
    if status not in ("PENDING", "COMPLETED"):
        raise ValueError("Status inválido")
    now = _now()
    with db(path) as con:
        con.execute("UPDATE tasks SET status=?, completed_at=?, updated_at=? WHERE task_id=?", (status, now if status == "COMPLETED" else None, now, task_id))


def delete_task(task_id, path=DB_PATH):
    with db(path) as con:
        con.execute("DELETE FROM tasks WHERE task_id=?", (task_id,))


def list_tasks(path=DB_PATH):
    with db(path) as con:
        return pd.read_sql_query("SELECT * FROM tasks", con)


def next_task(tasks: pd.DataFrame, opportunity_id):
    pending = tasks[(tasks["opportunity_id"] == opportunity_id) & (tasks["status"] == "PENDING")].copy()
    if pending.empty:
        return None
    pending["sort_due"] = pending["due_date"].fillna("9999-12-31")
    return pending.sort_values(["sort_due", "created_at", "task_id"]).iloc[0]


def suggest_title(action_tag):
    suggestion = INITIAL_TASKS.get(action_tag)
    return suggestion[0] if suggestion else None


INITIAL_TASKS = {
    "ACTION_WORK_NOW": ("Fazer contato comercial", "Entrar em contato com a oportunidade e registrar o resultado da interação."),
    "ACTION_ENRICH_ACCOUNT": ("Completar dados da conta", "Buscar as informações ausentes da empresa antes da próxima abordagem."),
    "ACTION_QUALIFY_PROSPECTING": ("Qualificar oportunidade", "Validar necessidade, contato responsável, contexto e prazo."),
    "ACTION_LAST_CONTACT_BEFORE_FREEZE": ("Fazer última tentativa de contato", "Revalidar interesse antes de congelar ou encerrar a oportunidade."),
}


def ensure_initial_tasks(frame: pd.DataFrame, path=DB_PATH):
    """Seed one initial task per open deal, once, without undoing user decisions."""
    with db(path) as con:
        seeded = {row[0] for row in con.execute("SELECT opportunity_id FROM task_seed_state")}
        pending = {row[0] for row in con.execute("SELECT DISTINCT opportunity_id FROM tasks WHERE status='PENDING'")}
        for _, row in frame.iterrows():
            oid = str(row["opportunity_id"])
            if row["deal_stage"] not in ("Prospecting", "Engaging") or oid in seeded or oid in pending:
                continue
            suggestion = INITIAL_TASKS.get(row["Action Tag"])
            if not suggestion:
                continue
            now = _now()
            con.execute("INSERT INTO tasks (task_id, opportunity_id, title, description, due_date, status, created_at, completed_at, updated_at, source) VALUES (?, ?, ?, ?, NULL, 'PENDING', ?, NULL, ?, 'SYSTEM_ACTION')", (uuid.uuid4().hex, oid, *suggestion, now, now))
            con.execute("INSERT INTO task_seed_state VALUES (?, ?)", (oid, now))
            seeded.add(oid)


def accept_suggestion(opportunity_id, action_tag, path=DB_PATH):
    title = suggest_title(action_tag)
    if not title:
        return None
    tasks = list_tasks(path)
    equivalent = tasks[(tasks["opportunity_id"] == opportunity_id) & (tasks["status"] == "PENDING") & (tasks["title"] == title)]
    return None if not equivalent.empty else create_task(opportunity_id, title, path=path)


def create_note(opportunity_id, content, path=DB_PATH):
    content = content.strip()
    if not content:
        raise ValueError("Observação vazia")
    note_id, now = uuid.uuid4().hex, _now()
    with db(path) as con:
        con.execute("INSERT INTO opportunity_notes VALUES (?, ?, ?, ?, ?)", (note_id, opportunity_id, content, now, now))
    return note_id


def update_note(note_id, content, path=DB_PATH):
    content = content.strip()
    if not content:
        raise ValueError("Observação vazia")
    with db(path) as con:
        con.execute("UPDATE opportunity_notes SET content=?, updated_at=? WHERE note_id=?", (content, _now(), note_id))


def delete_note(note_id, path=DB_PATH):
    with db(path) as con:
        con.execute("DELETE FROM opportunity_notes WHERE note_id=?", (note_id,))


def list_notes(path=DB_PATH):
    with db(path) as con:
        return pd.read_sql_query("SELECT * FROM opportunity_notes ORDER BY created_at DESC", con)


def create_pipeline_stage(name, path=DB_PATH):
    name = name.strip()
    if not name:
        raise ValueError("Nome da etapa é obrigatório")
    stage_id = uuid.uuid4().hex
    with db(path) as con:
        if con.execute("SELECT 1 FROM custom_pipeline_stages WHERE lower(name)=lower(?)", (name,)).fetchone():
            raise ValueError("Já existe uma etapa com esse nome")
        con.execute("INSERT INTO custom_pipeline_stages VALUES (?, ?, ?)", (stage_id, name, _now()))
    return stage_id


def list_pipeline_stages(path=DB_PATH):
    with db(path) as con:
        return [dict(row) for row in con.execute("SELECT * FROM custom_pipeline_stages ORDER BY created_at")]


def set_opportunity_pipeline_stage(opportunity_id, stage_id=None, path=DB_PATH):
    with db(path) as con:
        if stage_id:
            con.execute(
                """INSERT INTO opportunity_stage_overrides VALUES (?, ?, ?)
                ON CONFLICT(opportunity_id) DO UPDATE SET stage_id=excluded.stage_id, updated_at=excluded.updated_at""",
                (opportunity_id, stage_id, _now()),
            )
        else:
            con.execute("DELETE FROM opportunity_stage_overrides WHERE opportunity_id=?", (opportunity_id,))


def list_stage_overrides(path=DB_PATH):
    with db(path) as con:
        return {row["opportunity_id"]: row["stage_id"] for row in con.execute("SELECT * FROM opportunity_stage_overrides")}


def create_user_opportunity(scored_row, path=DB_PATH):
    opportunity_id = str(scored_row["opportunity_id"])
    payload = {}
    for key, value in dict(scored_row).items():
        if isinstance(value, (pd.Timestamp, datetime, date)):
            payload[key] = value.isoformat()
        elif hasattr(value, "item"):
            payload[key] = value.item()
        elif pd.isna(value) if not isinstance(value, (list, dict)) else False:
            payload[key] = None
        else:
            payload[key] = value
    with db(path) as con:
        con.execute("INSERT INTO user_opportunities VALUES (?, ?, ?)", (opportunity_id, json.dumps(payload, ensure_ascii=False), _now()))
    return opportunity_id


def list_user_opportunities(path=DB_PATH):
    with db(path) as con:
        payloads = [json.loads(row[0]) for row in con.execute("SELECT scored_payload FROM user_opportunities ORDER BY created_at")]
    return pd.DataFrame(payloads)

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EmailSchedule, EmailSendLog } from "@/services/email/email-types";

export interface EmailRepository {
  schedules(): EmailSchedule[];
  findSchedule(id: string): EmailSchedule | null;
  saveSchedule(schedule: EmailSchedule): void;
  deleteSchedule(id: string): void;
  due(now: string): EmailSchedule[];
  log(id: string): EmailSendLog | null;
  logs(): EmailSendLog[];
  claim(log: EmailSendLog): boolean;
  finish(id: string, status: "SENT" | "FAILED", providerMessageId: string | null, error: string | null, at: string): void;
  markSent(schedule: EmailSchedule, sentAt: string, next: string): void;
  close(): void;
}

export function createEmailRepository(filename = process.env.ARENA_DB_PATH ?? path.join(process.cwd(), "data", "arena-operations.sqlite")): EmailRepository {
  if (filename !== ":memory:") mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(`CREATE TABLE IF NOT EXISTS email_schedules (
    id TEXT PRIMARY KEY, recipient TEXT NOT NULL, enabled INTEGER NOT NULL, frequency TEXT NOT NULL,
    send_time TEXT NOT NULL, weekday INTEGER, day_of_month INTEGER, timezone TEXT NOT NULL,
    scope_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    last_sent_at TEXT, next_run_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS email_schedules_due ON email_schedules(enabled, next_run_at);
  CREATE TABLE IF NOT EXISTS email_send_log (
    id TEXT PRIMARY KEY, schedule_id TEXT, scheduled_for TEXT NOT NULL, sent_at TEXT,
    recipient TEXT NOT NULL, status TEXT NOT NULL, provider_message_id TEXT, error TEXT,
    type TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS email_send_once ON email_send_log(schedule_id, scheduled_for, type) WHERE schedule_id IS NOT NULL AND type='AUTOMATIC';`);
  const scheduleFrom = (row: Record<string, unknown>): EmailSchedule => ({
    id: String(row.id), recipient: String(row.recipient), enabled: Boolean(row.enabled), frequency: row.frequency as EmailSchedule["frequency"],
    sendTime: String(row.send_time), weekday: row.weekday === null ? null : Number(row.weekday), dayOfMonth: row.day_of_month === null ? null : Number(row.day_of_month),
    timezone: "America/Sao_Paulo", scope: JSON.parse(String(row.scope_json)), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    lastSentAt: row.last_sent_at === null ? null : String(row.last_sent_at), nextRunAt: String(row.next_run_at),
  });
  const logFrom = (row: Record<string, unknown>): EmailSendLog => ({
    id: String(row.id), scheduleId: row.schedule_id === null ? null : String(row.schedule_id), scheduledFor: String(row.scheduled_for),
    sentAt: row.sent_at === null ? null : String(row.sent_at), recipient: String(row.recipient), status: row.status as EmailSendLog["status"],
    providerMessageId: row.provider_message_id === null ? null : String(row.provider_message_id), error: row.error === null ? null : String(row.error),
    type: row.type as EmailSendLog["type"], payload: String(row.payload), updatedAt: String(row.updated_at),
  });
  return {
    schedules: () => db.prepare("SELECT * FROM email_schedules ORDER BY created_at DESC").all().map(scheduleFrom),
    findSchedule: (id) => { const row = db.prepare("SELECT * FROM email_schedules WHERE id=?").get(id); return row ? scheduleFrom(row) : null; },
    saveSchedule: (s) => { db.prepare(`INSERT INTO email_schedules VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      recipient=excluded.recipient,enabled=excluded.enabled,frequency=excluded.frequency,send_time=excluded.send_time,
      weekday=excluded.weekday,day_of_month=excluded.day_of_month,scope_json=excluded.scope_json,updated_at=excluded.updated_at,
      last_sent_at=excluded.last_sent_at,next_run_at=excluded.next_run_at`).run(s.id,s.recipient,Number(s.enabled),s.frequency,s.sendTime,s.weekday,s.dayOfMonth,s.timezone,JSON.stringify(s.scope),s.createdAt,s.updatedAt,s.lastSentAt,s.nextRunAt); },
    deleteSchedule: (id) => { db.prepare("DELETE FROM email_schedules WHERE id=?").run(id); },
    due: (now) => db.prepare("SELECT * FROM email_schedules WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at LIMIT 100").all(now).map(scheduleFrom),
    log: (id) => { const row = db.prepare("SELECT * FROM email_send_log WHERE id=?").get(id); return row ? logFrom(row) : null; },
    logs: () => db.prepare("SELECT * FROM email_send_log ORDER BY updated_at DESC").all().map(logFrom),
    claim: (entry) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = entry.scheduleId ? db.prepare("SELECT * FROM email_send_log WHERE schedule_id=? AND scheduled_for=? AND type='AUTOMATIC'").get(entry.scheduleId,entry.scheduledFor) : null;
        if (row) { const prior = logFrom(row); const elapsed = Date.now() - Date.parse(prior.updatedAt);
          if (prior.status === "SENT" || (prior.status === "PROCESSING" && elapsed < 5 * 60_000) || (prior.status === "FAILED" && elapsed < 60_000)) { db.exec("COMMIT"); return false; }
          db.prepare("UPDATE email_send_log SET status='PROCESSING',updated_at=? WHERE id=?").run(entry.updatedAt,prior.id);
        } else db.prepare("INSERT INTO email_send_log VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(entry.id,entry.scheduleId,entry.scheduledFor,null,entry.recipient,"PROCESSING",null,null,entry.type,entry.payload,entry.updatedAt);
        db.exec("COMMIT"); return true;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    finish: (id,status,message,error,at) => { db.prepare("UPDATE email_send_log SET status=?,provider_message_id=?,error=?,sent_at=?,updated_at=? WHERE id=?").run(status,message,error,status === "SENT" ? at : null,at,id); },
    markSent: (s,sentAt,next) => { db.prepare("UPDATE email_schedules SET last_sent_at=?,next_run_at=?,updated_at=? WHERE id=? AND next_run_at=?").run(sentAt,next,sentAt,s.id,s.nextRunAt); },
    close: () => db.close(),
  };
}

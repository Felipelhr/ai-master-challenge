import { randomUUID } from "node:crypto";
import type { CrmSnapshot } from "@/services/crm/crm-service";
import type { PriorityFilters } from "@/services/priorities/rank-top-five";
import type { EmailRepository } from "@/repositories/email/sqlite-email-repository";
import type { EmailSchedule, EmailSendLog, ScheduleInput } from "./email-types";
import { EMAIL_TIMEZONE, nextRunAt } from "./schedule-time";
import { priorityDigest } from "./priority-digest";
import type { EmailAdapter, EmailMessage } from "./resend-adapter";

function validate(input: ScheduleInput) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient) || input.recipient.length > 254) throw new Error("Destinatário inválido.");
  if (!["daily", "weekly", "monthly"].includes(input.frequency)) throw new Error("Frequência inválida.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.sendTime)) throw new Error("Horário inválido.");
  if (input.frequency === "weekly" && (!Number.isInteger(input.weekday) || input.weekday! < 0 || input.weekday! > 6)) throw new Error("Dia da semana inválido.");
  if (input.frequency === "monthly" && (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth! < 1 || input.dayOfMonth! > 31)) throw new Error("Dia do mês inválido.");
}

export function saveEmailSchedule(repo: EmailRepository, input: ScheduleInput, id?: string, now = new Date()): EmailSchedule {
  validate(input);
  const previous = id ? repo.findSchedule(id) : null;
  if (id && !previous) throw new Error("Agendamento não encontrado.");
  const timestamp = now.toISOString();
  const schedule: EmailSchedule = { ...input, scope: { ...input.scope }, id: previous?.id ?? randomUUID(), timezone: EMAIL_TIMEZONE,
    createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp, lastSentAt: previous?.lastSentAt ?? null, nextRunAt: nextRunAt(input, now) };
  repo.saveSchedule(schedule);
  return schedule;
}

export function setEmailScheduleEnabled(repo: EmailRepository, id: string, enabled: boolean, now = new Date()) {
  const schedule = repo.findSchedule(id);
  if (!schedule) throw new Error("Agendamento não encontrado.");
  const updated = { ...schedule, enabled, updatedAt: now.toISOString(), nextRunAt: enabled ? nextRunAt(schedule, now) : schedule.nextRunAt };
  repo.saveSchedule(updated);
  return updated;
}

function message(recipient: string, digest: ReturnType<typeof priorityDigest>, idempotencyKey: string): EmailMessage {
  return { to: recipient, subject: digest.subject, html: digest.html, text: digest.text, idempotencyKey };
}

export async function sendManualDigest(repo: EmailRepository, adapter: EmailAdapter, snapshot: CrmSnapshot, recipient: string, scope: PriorityFilters, now = new Date()) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Destinatário inválido.");
  const id = randomUUID(), timestamp = now.toISOString();
  const payload = message(recipient, priorityDigest(snapshot, scope), `arena-manual-${id}`);
  const log: EmailSendLog = { id, scheduleId: null, scheduledFor: timestamp, sentAt: null, recipient, status: "PROCESSING", providerMessageId: null, error: null, type: "MANUAL", payload: JSON.stringify(payload), updatedAt: timestamp };
  repo.claim(log);
  try { const providerId = await adapter.send(payload); repo.finish(id, "SENT", providerId, null, new Date().toISOString()); return providerId; }
  catch (error) { repo.finish(id, "FAILED", null, String(error), new Date().toISOString()); throw error; }
}

export async function runDueEmailSchedules(repo: EmailRepository, adapter: EmailAdapter, loadSnapshot: () => Promise<CrmSnapshot>, now = new Date()) {
  const due = repo.due(now.toISOString());
  if (!due.length) return { due: 0, sent: 0, failed: 0, skipped: 0 };
  const snapshot = await loadSnapshot();
  const result = { due: due.length, sent: 0, failed: 0, skipped: 0 };
  for (const schedule of due) {
    const timestamp = new Date().toISOString();
    const id = `auto-${schedule.id}-${schedule.nextRunAt}`;
    try {
      const existing = repo.log(id);
      if (existing?.status === "SENT") {
        repo.markSent(schedule, existing.sentAt ?? timestamp, nextRunAt(schedule, now));
        result.skipped++;
        continue;
      }
      const payload = existing ? JSON.parse(existing.payload) as EmailMessage : message(schedule.recipient, priorityDigest(snapshot, schedule.scope), id);
      const log: EmailSendLog = { id, scheduleId: schedule.id, scheduledFor: schedule.nextRunAt, sentAt: null, recipient: schedule.recipient,
        status: "PROCESSING", providerMessageId: null, error: null, type: "AUTOMATIC", payload: JSON.stringify(payload), updatedAt: timestamp };
      if (!repo.claim(log)) { result.skipped++; continue; }
      const providerId = await adapter.send(payload);
      repo.finish(id, "SENT", providerId, null, new Date().toISOString());
      repo.markSent(schedule, new Date().toISOString(), nextRunAt(schedule, now));
      result.sent++;
    } catch (error) { repo.finish(id, "FAILED", null, String(error), new Date().toISOString()); result.failed++; }
  }
  return result;
}

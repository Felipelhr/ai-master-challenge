"use client";

import { useState } from "react";
import { deletePriorityEmailSchedule, previewPriorityEmail, savePriorityEmailSchedule, sendPriorityEmail, togglePriorityEmailSchedule } from "@/app/email-actions";
import type { EmailSchedule, EmailFrequency } from "@/services/email/email-types";
import type { PriorityFilters } from "@/services/priorities/rank-top-five";
import { Button } from "@/components/ui/button";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const FREQUENCY: Record<EmailFrequency, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";

export function EmailDigestPanel({ scope, initialSchedules, available }: { scope: PriorityFilters; initialSchedules: EmailSchedule[]; available: boolean }) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [recipient, setRecipient] = useState("");
  const [automatic, setAutomatic] = useState(false);
  const [frequency, setFrequency] = useState<EmailFrequency>("daily");
  const [sendTime, setSendTime] = useState("08:00");
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [editing, setEditing] = useState<string | undefined>();
  const [preview, setPreview] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const validRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  async function perform(work: () => Promise<void>) {
    setBusy(true); setFeedback("");
    try { await work(); } catch (error) { setFeedback(error instanceof Error ? error.message : "Operação indisponível."); }
    finally { setBusy(false); }
  }
  function edit(schedule: EmailSchedule) {
    setEditing(schedule.id); setRecipient(schedule.recipient); setAutomatic(schedule.enabled); setFrequency(schedule.frequency);
    setSendTime(schedule.sendTime); setWeekday(schedule.weekday ?? 1); setDayOfMonth(schedule.dayOfMonth ?? 1);
    setFeedback("Ao salvar, o escopo será o dos filtros atuais.");
  }
  const summary = (filters: PriorityFilters) => Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Toda a carteira";
  return <section className="email-panel">
    <header><div><span className="priority-eyebrow">RESUMO OPERACIONAL</span><h2>Suas prioridades por e-mail</h2><p>Até cinco oportunidades por fila, com ação e próxima tarefa. As posições não são comparáveis entre filas.</p></div></header>
    <div className="email-form-row"><label>Destinatário<input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="nome@empresa.com" /></label><div className="email-buttons"><Button variant="outline" disabled={busy} onClick={() => perform(async () => { const result = await previewPriorityEmail(scope); setPreview(result.text); setFeedback(`Prévia: ${result.ids.length} prioridades.`); })}>Pré-visualizar</Button><Button disabled={busy || !available || !validRecipient} onClick={() => perform(async () => { await sendPriorityEmail(recipient, scope); setFeedback("Resumo enviado."); })}>Enviar agora</Button></div></div>
    {!available && <p className="email-availability">Envio real indisponível até configurar RESEND_API_KEY e RESEND_FROM_EMAIL. Prévia e agendamentos continuam disponíveis.</p>}
    {preview && <pre className="email-preview">{preview}</pre>}
    <label className="email-check"><input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} /> Envio automático</label>
    {automatic && <div className="email-schedule-fields"><label>Frequência<select value={frequency} onChange={(event) => setFrequency(event.target.value as EmailFrequency)}><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>{frequency === "weekly" && <label>Dia da semana<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{DAYS.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>}{frequency === "monthly" && <label>Dia do mês<select value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))}>{Array.from({ length: 31 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>}<label>Horário de Brasília<input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} /></label></div>}
    <div className="email-save"><Button variant="outline" disabled={busy || !validRecipient} onClick={() => perform(async () => { const list = await savePriorityEmailSchedule({ recipient, enabled: automatic, frequency, sendTime, weekday: frequency === "weekly" ? weekday : null, dayOfMonth: frequency === "monthly" ? dayOfMonth : null, scope }, editing); setSchedules(list); setEditing(undefined); setFeedback(automatic ? "Agendamento salvo com os filtros atuais." : "Agendamento salvo em pausa."); })}>{editing ? "Salvar alterações" : "Salvar agendamento"}</Button>{editing && <Button variant="ghost" onClick={() => { setEditing(undefined); setFeedback(""); }}>Cancelar edição</Button>}</div>
    {feedback && <p role="status" className="email-feedback">{feedback}</p>}
    <div className="email-schedules"><h3>Agendamentos</h3>{schedules.length === 0 && <p>Nenhum agendamento configurado.</p>}{schedules.map((schedule) => <article key={schedule.id}><div><strong>{schedule.recipient}</strong><span>{FREQUENCY[schedule.frequency]} · {schedule.sendTime} · Brasília</span><span>{schedule.enabled ? available ? "Ativo" : "Aguardando credenciais" : "Pausado"}</span></div><div><small>Próximo envio: {date(schedule.nextRunAt)}</small><small>Último envio: {date(schedule.lastSentAt)}</small><small title={summary(schedule.scope)}>Escopo: {summary(schedule.scope)}</small></div><div className="email-schedule-actions"><button disabled={busy} onClick={() => edit(schedule)}>Editar</button><button disabled={busy} onClick={() => perform(async () => { setSchedules(await togglePriorityEmailSchedule(schedule.id, !schedule.enabled)); })}>{schedule.enabled ? "Pausar" : "Reativar"}</button><button disabled={busy} onClick={() => perform(async () => { setSchedules(await deletePriorityEmailSchedule(schedule.id)); })}>Excluir</button></div></article>)}</div>
  </section>;
}

"use client";

import { useMemo, useState } from "react";
import type { CrmSnapshot } from "@/services/crm/crm-service";
import type { PriorityFilters } from "@/services/priorities/rank-top-five";
import { dashboardMetrics, PRIORITIZED_SCORE_CUTOFF, type DashboardPeriod } from "@/services/dashboard/dashboard-metrics";
import { CrmFilters } from "@/components/arena-shell/crm-filters";
import { TopFivePanel } from "@/components/priority/top-five-panel";
import { nextTasksByDeal } from "@/domain/tasks/next-task";
import type { CrmDeal } from "@/domain/deals/deal";
import { currency, number } from "@/lib/format";

export function DashboardPage({ snapshot, filters, onFilters, onNavigate, onOpen }: {
  snapshot: CrmSnapshot; filters: PriorityFilters; onFilters: (value: PriorityFilters) => void;
  onNavigate: (view: "list" | "kanban" | "priorities" | "tasks") => void; onOpen: (deal: CrmDeal) => void;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("all");
  const metrics = useMemo(() => dashboardMetrics(snapshot, filters, period), [snapshot, filters, period]);
  const nextTasks = useMemo(() => nextTasksByDeal(snapshot.tasks), [snapshot.tasks]);
  const maxStage = Math.max(1, ...metrics.stages.map((stage) => stage.count));
  const distribution = (items: {label:string;count:number;value:number}[], max: number) => <div className="dashboard-bars">{items.map((item) => <div className="dashboard-bar" key={item.label}><div className="dashboard-bar-heading"><span>{item.label}</span><strong>{number.format(item.count)}</strong></div><div className="dashboard-track"><span style={{ width: `${Math.max(0, item.count / max * 100)}%` }} /></div><small>{currency.format(item.value)}</small></div>)}</div>;
  return <div className="dashboard-page">
    <div className="dashboard-intro"><div><h2>Visão da operação</h2><p>Carteira, foco comercial e execução em um único painel.</p></div><span>O período afeta tarefas concluídas; a carteira mostra o estado atual.</span></div>
    <div className="dashboard-filter-bar"><label>Período das tarefas<select value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}><option value="all">Todo o período</option><option value="month">Este mês</option><option value="previous">Mês anterior</option></select></label><CrmFilters deals={snapshot.deals} stages={snapshot.stages} funnels={snapshot.funnels} tags={snapshot.tags} value={filters} onChange={onFilters} /></div>
    <div className="dashboard-kpis">
      <button onClick={() => onNavigate("list")}><span>Oportunidades abertas</span><strong>{number.format(metrics.open.count)}</strong><small>{currency.format(metrics.open.value)} em carteira</small></button>
      <button onClick={() => { onFilters({ ...filters, queue: "SELL", action: "" }); onNavigate("priorities"); }}><span>Venda ativa · estimativa temporal</span><strong>{number.format(metrics.temporal.count)}</strong><small>{currency.format(metrics.temporal.value)} · modelo ou fallback</small></button>
      <div><span>Score médio · Venda ativa</span><strong>{metrics.averageScore?.toFixed(1) ?? "—"}</strong><small>Somente {metrics.temporal.count} negócios com estimativa temporal</small></div>
      <div><span>Leads premium · A+ / A</span><strong>{number.format(metrics.premium.count)}</strong><small>{currency.format(metrics.premium.value)} em valor</small></div>
    </div>
    <section className="dashboard-wide"><TopFivePanel compact ranking={metrics.topFive} scores={snapshot.scores} tiers={snapshot.tiers} nextTasks={nextTasks} onOpen={onOpen} onSeeAll={() => onNavigate("priorities")} /></section>
    <div className="dashboard-grid">
      <section className="dashboard-card"><header><h3>Pipeline por etapa</h3><button onClick={() => onNavigate("kanban")}>Ver pipeline →</button></header>{distribution(metrics.stages, maxStage)}</section>
      <section className="dashboard-card"><header><h3>Ações recomendadas</h3><button onClick={() => onNavigate("priorities")}>Ver prioridades →</button></header>{distribution(metrics.actions, Math.max(1, ...metrics.actions.map((item) => item.count)))}</section>
      <section className="dashboard-card"><header><h3>Lead Tier</h3></header><p>Distribuição de potencial comercial</p>{distribution(metrics.tiers, Math.max(1, ...metrics.tiers.map((item) => item.count)))}</section>
      <section className="dashboard-card"><header><h3>Qualidade da Evidência</h3><span title="Indica o nível relativo de suporte informacional disponível para o cálculo da prioridade. Não representa chance de fechamento.">ⓘ</span></header><p>Suporte informacional da prioridade</p>{distribution(metrics.evidence, Math.max(1, ...metrics.evidence.map((item) => item.count)))}</section>
      <section className="dashboard-card"><header><h3>Tarefas</h3><button onClick={() => onNavigate("tasks")}>Ver tarefas →</button></header><div className="dashboard-task-stats"><div><strong>{number.format(metrics.tasks.pending)}</strong><span>Pendentes</span></div><div><strong>{number.format(metrics.tasks.overdue)}</strong><span>Vencidas</span></div><div><strong>{number.format(metrics.tasks.completed)}</strong><span>Concluídas {period === "all" ? "" : "no período"}</span></div></div></section>
      <section className="dashboard-card dashboard-value"><header><h3>Valor priorizado · Venda ativa</h3></header><strong>{currency.format(metrics.prioritized.value)}</strong><p>{number.format(metrics.prioritized.count)} oportunidades de Venda ativa com Score ≥ {PRIORITIZED_SCORE_CUTOFF}. Corte operacional.</p><button onClick={() => { onFilters({ ...filters, queue: "SELL", minScore: String(PRIORITIZED_SCORE_CUTOFF) }); onNavigate("priorities"); }}>Ver recorte →</button></section>
    </div>
  </div>;
}

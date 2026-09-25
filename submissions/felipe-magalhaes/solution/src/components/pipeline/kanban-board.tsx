"use client";

import { useState } from "react";
import type { CrmDeal } from "@/domain/deals/deal";
import type { PipelineStage } from "@/domain/pipeline/stage";
import type { Task } from "@/domain/tasks/task";
import { currency, number } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DealCard } from "./deal-card";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import type { TiersByDeal } from "@/services/tiering/tier-snapshot";
import { sortOperationalDeals } from "@/services/crm/operational-order";
import { displayStageId } from "@/domain/pipeline/stage";
import type { Mutate } from "@/components/deals/operations-panels";

const INITIAL_COUNT = 25;

export function KanbanBoard({ deals, scores, tiers, stages, funnelId, nextTasks, pending, mutate, onOpen }: { deals: CrmDeal[]; scores: ScoresByDeal; tiers: TiersByDeal; stages: PipelineStage[]; funnelId: string; nextTasks: Record<string, Task>; pending: boolean; mutate: Mutate; onOpen: (deal: CrmDeal) => void }) {
  const [addingStage, setAddingStage] = useState(false);
  const [stageName, setStageName] = useState("");
  const groups = new Map<string, CrmDeal[]>();
  for (const deal of deals) { const stageId = displayStageId(deal); if (!stageId) continue; const group = groups.get(stageId) ?? []; group.push(deal); groups.set(stageId, group); }
  async function addStage() {
    if (!stageName.trim() || pending) return;
    try { await mutate({ kind: "stage.create", funnelId, name: stageName.trim() }); setStageName(""); setAddingStage(false); } catch { /* O erro aparece no aviso global. */ }
  }
  return <div className="kanban-board">{stages.map((stage) => <KanbanColumn key={stage.id} stage={stage} deals={sortOperationalDeals(groups.get(stage.id) ?? [], scores)} scores={scores} tiers={tiers} nextTasks={nextTasks} onOpen={onOpen} />)}<section className="kanban-add-column"><button className="kanban-add-trigger" onClick={() => setAddingStage(true)} aria-label="Adicionar próxima etapa">+<span>Adicionar etapa</span></button>{addingStage && <form onSubmit={(event) => { event.preventDefault(); void addStage(); }}><input autoFocus aria-label="Nome da próxima etapa" placeholder="Nome da próxima etapa" maxLength={60} value={stageName} onChange={(event) => setStageName(event.target.value)} /><div><Button type="submit" disabled={pending || !stageName.trim()}>Criar etapa</Button><Button type="button" variant="ghost" onClick={() => { setAddingStage(false); setStageName(""); }}>Cancelar</Button></div></form>}</section></div>;
}

function KanbanColumn({ stage, deals, scores, tiers, nextTasks, onOpen }: { stage: PipelineStage; deals: CrmDeal[]; scores: ScoresByDeal; tiers: TiersByDeal; nextTasks: Record<string, Task>; onOpen: (deal: CrmDeal) => void }) {
  const [limit, setLimit] = useState(INITIAL_COUNT);
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  return <section className="kanban-column">
    <header className="column-header"><div><strong>{stage.name}</strong><span>{number.format(deals.length)}</span></div><span>{currency.format(totalValue)}</span></header>
    <div className="column-scroll">
      {deals.length === 0 ? <div className="column-empty">Nenhum negócio</div> : deals.slice(0, limit).map((deal) => <DealCard key={deal.id} deal={deal} score={scores[deal.id]} tier={tiers[deal.id]?.tier ?? "—"} nextTask={nextTasks[deal.id] ?? null} onOpen={onOpen} />)}
      {limit < deals.length && <Button variant="outline" className="load-more" onClick={() => setLimit(limit + INITIAL_COUNT)}>Carregar mais {Math.min(INITIAL_COUNT, deals.length - limit)}</Button>}
    </div>
  </section>;
}

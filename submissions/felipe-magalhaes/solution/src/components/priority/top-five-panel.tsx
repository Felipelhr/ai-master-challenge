"use client";

import type { CrmDeal } from "@/domain/deals/deal";
import type { Task } from "@/domain/tasks/task";
import { pipelineTime } from "@/domain/pipeline/pipeline-time";
import { ACTION_LABELS, CONFIDENCE_LABELS, EVIDENCE_HELP } from "@/domain/scoring/labels";
import { currency } from "@/lib/format";
import type { TopFiveResult } from "@/services/priorities/rank-top-five";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import type { TiersByDeal } from "@/services/tiering/tier-snapshot";
import { Button } from "@/components/ui/button";
import { QUEUE_LABELS, QUEUE_DESCRIPTIONS, priorityCaption } from "@/domain/scoring/priority-queue";

export function TopFivePanel({ ranking, scores, tiers, nextTasks, onOpen, compact = false, onSeeAll }: {
  ranking: TopFiveResult; scores: ScoresByDeal; tiers: TiersByDeal; nextTasks: Record<string, Task>;
  onOpen: (deal: CrmDeal) => void; compact?: boolean; onSeeAll?: () => void;
}) {
  return <section className={compact ? "top-five-panel is-compact" : "top-five-panel"}>
    <header className="top-five-heading"><div><span className="priority-eyebrow">FILAS DE TRABALHO</span><h2>Top 5 por fila</h2><p>{ranking.eligibleCount} oportunidades abertas no recorte. As filas são independentes; a distribuição do tempo entre elas é uma decisão comercial.</p></div>{onSeeAll && <Button variant="outline" onClick={onSeeAll}>Ver todas as prioridades</Button>}</header>
    {ranking.queues.map((group) => <section className="priority-queue-section" key={group.queue} aria-label={`Top 5 · ${QUEUE_LABELS[group.queue]}`}>
      <header className="priority-queue-heading"><h3>{QUEUE_LABELS[group.queue]} <span>{group.eligibleCount} oportunidades</span></h3><p>{QUEUE_DESCRIPTIONS[group.queue]}</p></header>
      {group.items.length === 0 ? <div className="top-five-empty">Nenhuma oportunidade nesta fila para os filtros atuais.</div> : <div className="top-five-grid">{group.items.map((deal, index) => {
      const score = scores[deal.id]; const tier = tiers[deal.id];
      return <button type="button" key={deal.id} className="top-five-card" onClick={() => onOpen(deal)} aria-label={`Abrir prioridade ${index + 1}: ${deal.account}`}>
        <div className="top-five-card-head"><span className="top-rank">#{index + 1} nesta fila</span><span className="top-score">{priorityCaption(score)}</span></div>
        <strong>{deal.account}</strong><small>{deal.id} · {deal.product}</small>
        <div className="top-five-metrics"><span>Lead Tier <b>{tier?.tier ?? "—"}</b></span>{!compact && <span title={EVIDENCE_HELP}>Qualidade da Evidência <b>{CONFIDENCE_LABELS[score.confidence]}</b></span>}</div><p className="top-five-action">{ACTION_LABELS[score.action]}</p>{!compact && <p className="top-five-why">{group.queue === "SELL" ? "Score ↓ → Valor ↓ → ID, somente em Venda ativa." : "Valor ↓ → ID. Sem estimativa de fechamento."}</p>}
        <div className="top-five-foot"><span>{currency.format(deal.value)} · {deal.agent}</span><span>Próxima tarefa: {nextTasks[deal.id]?.title ?? "Nenhuma"}</span>{!compact && <span>Tempo no pipeline: {pipelineTime(deal)}</span>}</div>
      </button>;
    })}</div>}</section>)}
  </section>;
}

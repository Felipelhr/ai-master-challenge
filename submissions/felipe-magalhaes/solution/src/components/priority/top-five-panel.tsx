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

export function TopFivePanel({ ranking, scores, tiers, nextTasks, onOpen, compact = false, onSeeAll }: {
  ranking: TopFiveResult; scores: ScoresByDeal; tiers: TiersByDeal; nextTasks: Record<string, Task>;
  onOpen: (deal: CrmDeal) => void; compact?: boolean; onSeeAll?: () => void;
}) {
  return <section className={compact ? "top-five-panel is-compact" : "top-five-panel"}>
    <header className="top-five-heading"><div><span className="priority-eyebrow">PRIORIDADES</span><h2>{compact ? "Top 5 para trabalhar agora" : "Top 5 do recorte atual"}</h2><p>{ranking.eligibleCount} oportunidades abertas elegíveis</p></div>{onSeeAll && <Button variant="outline" onClick={onSeeAll}>Ver todas as prioridades</Button>}</header>
    {ranking.items.length === 0 ? <div className="top-five-empty">Nenhuma oportunidade aberta corresponde aos filtros.</div> : <div className="top-five-grid">{ranking.items.map((deal, index) => {
      const score = scores[deal.id]; const tier = tiers[deal.id];
      return <button type="button" key={deal.id} className="top-five-card" onClick={() => onOpen(deal)} aria-label={`Abrir prioridade ${index + 1}: ${deal.account}`}>
        <div className="top-five-card-head"><span className="top-rank">#{index + 1}</span><span className="top-score">Score {score.priorityScore}</span></div>
        <strong>{deal.account}</strong><small>{deal.id} · {deal.product}</small>
        <div className="top-five-metrics"><span>Lead Tier <b>{tier?.tier ?? "—"}</b></span>{!compact && <span title={EVIDENCE_HELP}>Qualidade da Evidência <b>{CONFIDENCE_LABELS[score.confidence]}</b></span>}</div><p className="top-five-action">{ACTION_LABELS[score.action]}</p>{!compact && <p className="top-five-why">Score {score.priorityScore} — {index + 1}ª maior prioridade dentro do recorte atual.</p>}
        <div className="top-five-foot"><span>{currency.format(deal.value)} · {deal.agent}</span><span>Próxima tarefa: {nextTasks[deal.id]?.title ?? "Nenhuma"}</span>{!compact && <span>Tempo no pipeline: {pipelineTime(deal)}</span>}</div>
      </button>;
    })}</div>}
  </section>;
}

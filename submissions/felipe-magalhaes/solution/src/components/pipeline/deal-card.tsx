"use client";

import { priorityCaption } from "@/domain/scoring/priority-queue";
import { ChevronRight } from "lucide-react";
import type { CrmDeal } from "@/domain/deals/deal";
import type { Task } from "@/domain/tasks/task";
import { pipelineTime } from "@/domain/pipeline/pipeline-time";
import { currency } from "@/lib/format";
import { ACTION_LABELS } from "@/domain/scoring/labels";
import type { PriorityResult } from "@/domain/scoring/scoring-engine";

export function DealCard({ deal, score, tier, nextTask, onOpen }: { deal: CrmDeal; score: PriorityResult | undefined; tier: string; nextTask: Task | null; onOpen: (deal: CrmDeal) => void }) {
  return <button type="button" className="deal-card" onClick={() => onOpen(deal)} aria-label={`Abrir oportunidade ${deal.id} de ${deal.account}`}>
    <div className="deal-card-top"><span className="deal-card-id">{deal.id}</span><span className="deal-card-badges"><span className="tier-badge">Tier {tier}</span><span className="score-pill">{priorityCaption(score)}</span></span></div>
    <div className="deal-card-main"><strong>{deal.account}</strong><b>{currency.format(deal.value)}</b></div>
    <div className="deal-card-product">{deal.product}</div>
    <div className="deal-card-signals"><span>{score ? ACTION_LABELS[score.action] : "Negócio encerrado"}</span><span>Tempo no pipeline: {pipelineTime(deal)}</span><span>Próxima tarefa: {nextTask?.title ?? "Nenhuma"}</span></div>
    <div className="deal-card-bottom"><span>{deal.agent}</span><ChevronRight size={16} /></div>
  </button>;
}

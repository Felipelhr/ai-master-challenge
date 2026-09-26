import type { CrmDeal } from "@/domain/deals/deal";
import { isOpenDeal } from "@/domain/deals/deal";
import type { DealTag } from "@/domain/tags/tag";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import type { TiersByDeal } from "@/services/tiering/tier-snapshot";
import { compareOperationalDeals } from "@/services/crm/operational-order";
import { PRIORITY_QUEUES, priorityQueue, hasTemporalScore, type PriorityQueue } from "@/domain/scoring/priority-queue";

export interface PriorityFilters {
  queue?: PriorityQueue | "";
  agent: string; manager: string; region: string; sector: string; product: string;
  funnelId: string; stageId: string; tagId: string; leadTier: string; confidence: string; action: string;
  minScore: string; maxScore: string;
}
export const emptyPriorityFilters: PriorityFilters = {
  queue: "",
  agent: "", manager: "", region: "", sector: "", product: "", funnelId: "", stageId: "", tagId: "",
  leadTier: "", confidence: "", action: "", minScore: "", maxScore: "",
};

export interface QueueRanking { queue: PriorityQueue; items: CrmDeal[]; eligibleCount: number }
export interface TopFiveResult { queues: QueueRanking[]; eligibleCount: number }

export function matchesPriorityScope(score: ScoresByDeal[string] | undefined, filters: PriorityFilters): boolean {
  if (filters.queue && priorityQueue(score) !== filters.queue) return false;
  if (filters.minScore || filters.maxScore) {
    if (!score || !hasTemporalScore(score)) return false;
    if (filters.minScore && score.priorityScore < Number(filters.minScore)) return false;
    if (filters.maxScore && score.priorityScore > Number(filters.maxScore)) return false;
  }
  return true;
}

export function filterPriorityDeals(deals: CrmDeal[], scores: ScoresByDeal, tiers: TiersByDeal, dealTags: DealTag[], filters: PriorityFilters = emptyPriorityFilters): CrmDeal[] {
  const tagged = filters.tagId ? new Set(dealTags.filter((link) => link.tagId === filters.tagId).map((link) => link.dealId)) : null;
  return deals.filter((deal) => {
    const score = scores[deal.id];
    if (!isOpenDeal(deal) || !score) return false;
    if (filters.agent && deal.agent !== filters.agent) return false;
    if (filters.manager && deal.manager !== filters.manager) return false;
    if (filters.region && deal.region !== filters.region) return false;
    if (filters.sector && deal.sector !== filters.sector) return false;
    if (filters.product && deal.product !== filters.product) return false;
    if (filters.funnelId && deal.funnelId !== filters.funnelId) return false;
    if (filters.stageId && deal.stageId !== filters.stageId) return false;
    if (tagged && !tagged.has(deal.id)) return false;
    if (filters.leadTier && tiers[deal.id]?.tier !== filters.leadTier) return false;
    if (filters.confidence && score.confidence !== filters.confidence) return false;
    if (filters.action && score.action !== filters.action) return false;
    if (!matchesPriorityScope(score, filters)) return false;
    return true;
  });
}

export function rankTopFive(deals: CrmDeal[], scores: ScoresByDeal, tiers: TiersByDeal, dealTags: DealTag[], filters: PriorityFilters = emptyPriorityFilters): TopFiveResult {
  const eligible = filterPriorityDeals(deals, scores, tiers, dealTags, filters);
  const queues = PRIORITY_QUEUES.filter((queue) => !filters.queue || filters.queue === queue).map((queue) => {
    const candidates = eligible.filter((deal) => priorityQueue(scores[deal.id]) === queue);
    candidates.sort((a, b) => compareOperationalDeals(a, b, scores));
    return { queue, items: candidates.slice(0, 5), eligibleCount: candidates.length };
  });
  return { queues, eligibleCount: eligible.length };
}

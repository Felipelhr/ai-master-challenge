import type { CrmDeal } from "@/domain/deals/deal";
import { isOpenDeal } from "@/domain/deals/deal";
import type { DealTag } from "@/domain/tags/tag";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import type { TiersByDeal } from "@/services/tiering/tier-snapshot";
import { compareOperationalDeals } from "@/services/crm/operational-order";

export interface PriorityFilters {
  agent: string; manager: string; region: string; sector: string; product: string;
  funnelId: string; stageId: string; tagId: string; leadTier: string; confidence: string; action: string;
  minScore: string; maxScore: string;
}
export const emptyPriorityFilters: PriorityFilters = {
  agent: "", manager: "", region: "", sector: "", product: "", funnelId: "", stageId: "", tagId: "",
  leadTier: "", confidence: "", action: "", minScore: "", maxScore: "",
};

export interface TopFiveResult { items: CrmDeal[]; eligibleCount: number }

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
    if (filters.minScore && score.priorityScore < Number(filters.minScore)) return false;
    if (filters.maxScore && score.priorityScore > Number(filters.maxScore)) return false;
    return true;
  });
}

export function rankTopFive(deals: CrmDeal[], scores: ScoresByDeal, tiers: TiersByDeal, dealTags: DealTag[], filters: PriorityFilters = emptyPriorityFilters): TopFiveResult {
  const eligible = filterPriorityDeals(deals, scores, tiers, dealTags, filters);
  eligible.sort((a, b) => compareOperationalDeals(a, b, scores));
  return { items: eligible.slice(0, 5), eligibleCount: eligible.length };
}

import type { Deal } from "@/domain/deals/deal";
import { scoringEngine } from "@/domain/scoring/engine";
import type { PriorityResult } from "@/domain/scoring/scoring-engine";

export type ScoresByDeal = Record<string, PriorityResult>;

export function scoreNewOpportunity(deal: Deal): PriorityResult | null {
  return scoringEngine.score(deal, "reference");
}

export function scoreSnapshot(deals: Deal[]): ScoresByDeal {
  const scored: ScoresByDeal = {};
  for (const deal of deals) {
    const result = "isNew" in deal && deal.isNew ? scoreNewOpportunity(deal) : scoringEngine.score(deal);
    if (result) scored[deal.id] = result;
  }
  return scored;
}

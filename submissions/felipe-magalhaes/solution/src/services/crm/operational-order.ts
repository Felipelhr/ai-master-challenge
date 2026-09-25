import type { CrmDeal } from "@/domain/deals/deal";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";

export function compareOperationalDeals(a: CrmDeal, b: CrmDeal, scores: ScoresByDeal): number {
  const first = scores[a.id], second = scores[b.id];
  if (Boolean(first) !== Boolean(second)) return first ? -1 : 1;
  return (second?.priorityScore ?? 0) - (first?.priorityScore ?? 0)
    || b.value - a.value
    || a.id.localeCompare(b.id);
}

export function sortOperationalDeals(deals: CrmDeal[], scores: ScoresByDeal): CrmDeal[] {
  return [...deals].sort((a, b) => compareOperationalDeals(a, b, scores));
}

export function sortDealsByScore(deals: CrmDeal[], scores: ScoresByDeal, direction: "asc" | "desc"): CrmDeal[] {
  return [...deals].sort((a, b) => {
    const first = scores[a.id], second = scores[b.id];
    if (Boolean(first) !== Boolean(second)) return first ? -1 : 1;
    return (direction === "asc" ? (first?.priorityScore ?? 0) - (second?.priorityScore ?? 0) : (second?.priorityScore ?? 0) - (first?.priorityScore ?? 0))
      || b.value - a.value
      || a.id.localeCompare(b.id);
  });
}

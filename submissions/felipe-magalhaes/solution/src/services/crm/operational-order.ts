import type { CrmDeal } from "@/domain/deals/deal";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import { PRIORITY_QUEUES, priorityQueue } from "@/domain/scoring/priority-queue";

function groupIndex(deal: CrmDeal, scores: ScoresByDeal): number {
  const queue = priorityQueue(scores[deal.id]);
  return queue ? PRIORITY_QUEUES.indexOf(queue) : PRIORITY_QUEUES.length;
}

export function compareOperationalDeals(a: CrmDeal, b: CrmDeal, scores: ScoresByDeal): number {
  const first = scores[a.id], second = scores[b.id];
  // Groups must be displayed with headers. Their order is navigation, not a global ranking.
  const group = groupIndex(a, scores) - groupIndex(b, scores);
  if (group) return group;
  return (priorityQueue(first) === "SELL" ? (second?.priorityScore ?? 0) - (first?.priorityScore ?? 0) : 0)
    || b.value - a.value
    || a.id.localeCompare(b.id);
}

export function sortOperationalDeals(deals: CrmDeal[], scores: ScoresByDeal): CrmDeal[] {
  return [...deals].sort((a, b) => compareOperationalDeals(a, b, scores));
}

export function sortDealsByScore(deals: CrmDeal[], scores: ScoresByDeal, direction: "asc" | "desc"): CrmDeal[] {
  return [...deals].sort((a, b) => {
    const first = scores[a.id], second = scores[b.id];
    const group = groupIndex(a, scores) - groupIndex(b, scores);
    if (group) return group;
    return (priorityQueue(first) === "SELL" ? (direction === "asc" ? (first?.priorityScore ?? 0) - (second?.priorityScore ?? 0) : (second?.priorityScore ?? 0) - (first?.priorityScore ?? 0)) : 0)
      || b.value - a.value
      || a.id.localeCompare(b.id);
  });
}

export function groupOperationalDeals(deals: CrmDeal[], scores: ScoresByDeal) {
  return [...PRIORITY_QUEUES, null].map((queue) => ({
    queue, items: deals.filter((deal) => priorityQueue(scores[deal.id]) === queue),
  })).filter((group) => group.items.length > 0);
}

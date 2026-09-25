import type { Deal } from "@/domain/deals/deal";
import { calculateLeadTier, type LeadTierResult } from "@/domain/tiering/lead-tier";

export type TiersByDeal = Record<string, LeadTierResult>;
export function tierSnapshot(deals: Deal[]): TiersByDeal {
  const result: TiersByDeal = {};
  for (const deal of deals) result[deal.id] = calculateLeadTier(deal);
  return result;
}

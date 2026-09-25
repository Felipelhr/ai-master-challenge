import type { CrmDeal, Deal, DealStatus } from "@/domain/deals/deal";

export interface DealsRepository {
  list(): Promise<Deal[]>;
  findById(id: string): Promise<Deal | null>;
}

export interface OperationalDealsRepository {
  listNew(): CrmDeal[];
  listOverrides(): Map<string, { stageId: string | null; funnelId: string; engageDate: string | null; status: DealStatus }>;
  saveNew(deal: CrmDeal): void;
  saveOverride(dealId: string, value: { stageId: string | null; funnelId: string; engageDate: string | null; status: DealStatus }): void;
}

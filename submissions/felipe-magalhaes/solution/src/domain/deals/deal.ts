export const DEAL_STAGES = ["Prospecting", "Engaging", "Won", "Lost"] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
export type DealStatus = "OPEN" | "WON" | "LOST";
export const STATUS_LABELS: Record<DealStatus, string> = { OPEN: "Aberto", WON: "Ganho", LOST: "Perdido" };
export function historicalStatus(stage: DealStage): DealStatus { return stage === "Won" ? "WON" : stage === "Lost" ? "LOST" : "OPEN"; }

export const STAGE_LABELS: Record<DealStage, string> = {
  Prospecting: "Prospecção",
  Engaging: "Em negociação",
  Won: "Ganho",
  Lost: "Perdido",
};

export interface Deal {
  id: string;
  account: string;
  accountKnown: boolean;
  sector: string | null;
  revenue: number | null;
  employees: number | null;
  yearEstablished: number | null;
  subsidiaryOf: string | null;
  officeLocation?: string | null;
  agent: string;
  manager: string;
  region: string;
  product: string;
  series: string;
  stage: DealStage;
  value: number;
  salesPrice: number;
  engageDate: string | null;
  closeDate: string | null;
}

export interface CrmDeal extends Deal {
  rawStage?: DealStage;
  status: DealStatus;
  funnelId: string;
  stageId: string | null;
  isNew?: boolean;
}

export function isOpenDeal(deal: Deal): boolean {
  if ("status" in deal) return deal.status === "OPEN";
  return deal.stage === "Prospecting" || deal.stage === "Engaging";
}

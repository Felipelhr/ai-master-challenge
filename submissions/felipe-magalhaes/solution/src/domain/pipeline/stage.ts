import type { CrmDeal } from "@/domain/deals/deal";

export interface PipelineStage {
  id: string;
  funnelId: string;
  name: string;
  order: number;
  category: "OPEN" | "WON" | "LOST" | "FINALIZATION";
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

export const DEFAULT_STAGE_ID: Record<string, string> = {
  Prospecting: "prospecting", Engaging: "engaging",
};

export const DEFAULT_FUNNEL_ID = "default";
export const FINALIZATION_STAGE_ID = "finalization";

export function displayStageId(deal: CrmDeal): string | null {
  return deal.status === "OPEN" ? deal.stageId : FINALIZATION_STAGE_ID;
}

export function finalizationStage(funnelId: string): PipelineStage {
  return { id: FINALIZATION_STAGE_ID, funnelId, name: "Finalização", order: Number.MAX_SAFE_INTEGER,
    category: "FINALIZATION", isDefault: true, active: true, createdAt: "" };
}

export interface Funnel { id: string; name: string; createdAt: string; updatedAt: string }

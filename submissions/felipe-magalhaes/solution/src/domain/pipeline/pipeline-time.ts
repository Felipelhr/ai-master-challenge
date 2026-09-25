import type { Deal } from "@/domain/deals/deal";
import { scoringSnapshotDate } from "@/domain/scoring/engine";

export function pipelineTime(deal: Deal): string {
  if (!deal.engageDate) return deal.stage === "Prospecting" ? "Ainda sem entrada em negociação" : "Data não informada";
  const end = deal.closeDate ?? scoringSnapshotDate;
  const days = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${deal.engageDate}T00:00:00Z`)) / 86_400_000));
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

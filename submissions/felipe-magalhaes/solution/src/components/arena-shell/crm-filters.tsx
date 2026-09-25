"use client";

import type { CrmDeal } from "@/domain/deals/deal";
import type { Funnel, PipelineStage } from "@/domain/pipeline/stage";
import { FINALIZATION_STAGE_ID } from "@/domain/pipeline/stage";
import type { Tag } from "@/domain/tags/tag";
import { ACTION_LABELS, CONFIDENCE_LABELS } from "@/domain/scoring/labels";
import { LEAD_TIERS } from "@/domain/tiering/lead-tier";
import { emptyPriorityFilters, type PriorityFilters } from "@/services/priorities/rank-top-five";
import { Button } from "@/components/ui/button";

export function CrmFilters({ deals, stages, funnels = [], tags, value, onChange }: { deals: CrmDeal[]; stages: PipelineStage[]; funnels?: Funnel[]; tags: Tag[]; value: PriorityFilters; onChange: (filters: PriorityFilters) => void }) {
  const unique = (key: "agent" | "manager" | "region" | "product" | "sector") => Array.from(new Set(deals.map((deal) => deal[key]).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const fields: { key: keyof PriorityFilters; label: string; options: [string, string][] }[] = [
    { key: "agent", label: "Vendedor", options: unique("agent").map((item) => [item, item]) },
    { key: "manager", label: "Manager", options: unique("manager").map((item) => [item, item]) },
    { key: "region", label: "Região", options: unique("region").map((item) => [item, item]) },
    { key: "product", label: "Produto", options: unique("product").map((item) => [item, item]) },
    { key: "sector", label: "Setor", options: unique("sector").map((item) => [item, item]) },
    { key: "funnelId", label: "Funil", options: funnels.map((funnel) => [funnel.id, funnel.name]) },
    { key: "stageId", label: "Etapa", options: [...stages.filter((stage) => stage.active && stage.category === "OPEN" && (!value.funnelId || stage.funnelId === value.funnelId)).map((stage): [string,string] => [stage.id, stage.name]), [FINALIZATION_STAGE_ID, "Finalização"]] },
    { key: "tagId", label: "Tags", options: tags.map((tag) => [tag.id, tag.name]) },
    { key: "leadTier", label: "Lead Tier", options: LEAD_TIERS.map((tier) => [tier, tier]) },
    { key: "confidence", label: "Qualidade da Evidência", options: Object.entries(CONFIDENCE_LABELS) },
    { key: "action", label: "Ação recomendada", options: Object.entries(ACTION_LABELS) },
    { key: "minScore", label: "Score mínimo", options: [["25", "25"], ["50", "50"], ["75", "75"], ["90", "90"]] },
    { key: "maxScore", label: "Score máximo", options: [["25", "25"], ["50", "50"], ["75", "75"], ["90", "90"]] },
  ];
  return <div className="crm-filters">
    {fields.map((field) => <label key={field.key}>{field.label}<select value={value[field.key] ?? ""} onChange={(event) => onChange({ ...value, [field.key]: event.target.value, ...(field.key === "funnelId" ? { stageId: "" } : {}) })}><option value="">Todos</option>{field.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>)}
    <Button variant="outline" onClick={() => onChange(emptyPriorityFilters)}>Limpar filtros</Button>
  </div>;
}

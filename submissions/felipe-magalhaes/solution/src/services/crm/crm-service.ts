import { randomUUID } from "node:crypto";
import { historicalStatus, isOpenDeal, type CrmDeal, type Deal, type DealStage, type DealStatus } from "@/domain/deals/deal";
import type { Task } from "@/domain/tasks/task";
import type { Tag, DealTag } from "@/domain/tags/tag";
import type { Note } from "@/domain/notes/note";
import { DEFAULT_FUNNEL_ID, DEFAULT_STAGE_ID, type Funnel, type PipelineStage } from "@/domain/pipeline/stage";
import { scoringSnapshotDate } from "@/domain/scoring/engine";
import type { ActionCode, PriorityResult, SystemSignal } from "@/domain/scoring/scoring-engine";
import { scoreSnapshot, type ScoresByDeal } from "@/services/scoring/score-snapshot";
import { tierSnapshot, type TiersByDeal } from "@/services/tiering/tier-snapshot";
import { createCrmStore, type CrmStore } from "@/repositories/sqlite/crm-store";

export interface CrmSnapshot {
  deals: CrmDeal[];
  scores: ScoresByDeal;
  tiers: TiersByDeal;
  tasks: Task[];
  tags: Tag[];
  dealTags: DealTag[];
  notes: Note[];
  stages: PipelineStage[];
  funnels: Funnel[];
}

export type NewDealInput = {
  account: string; product: string; series: string; salesPrice: number; agent: string;
  manager: string; region: string; funnelId: string; stageId: string; engageDate: string | null;
  accountKnown: boolean; sector: string | null; revenue: number | null;
  employees: number | null; yearEstablished: number | null; subsidiaryOf: string | null;
  officeLocation?: string | null;
};

export type CrmOperation =
  | { kind: "task.create"; dealId: string; title: string; description: string | null; dueAt: string | null }
  | { kind: "task.update"; id: string; title: string; description: string | null; dueAt: string | null }
  | { kind: "task.status"; id: string; status: Task["status"] }
  | { kind: "task.delete"; id: string }
  | { kind: "tag.create"; name: string; color: string; dealId: string }
  | { kind: "tag.update"; id: string; name: string; color: string }
  | { kind: "tag.attach"; dealId: string; tagId: string }
  | { kind: "tag.detach"; dealId: string; tagId: string }
  | { kind: "note.create"; dealId: string; content: string }
  | { kind: "note.update"; id: string; content: string }
  | { kind: "note.delete"; id: string }
  | { kind: "funnel.create"; name: string }
  | { kind: "funnel.update"; id: string; name: string }
  | { kind: "stage.create"; name: string; funnelId: string }
  | { kind: "stage.update"; id: string; name: string }
  | { kind: "stage.move"; id: string; direction: -1 | 1 }
  | { kind: "stage.delete"; id: string }
  | { kind: "deal.stage"; dealId: string; stageId: string; engageDate?: string | null }
  | { kind: "deal.status"; dealId: string; status: DealStatus }
  | { kind: "deal.create"; input: NewDealInput };

const ACTION_TASK: Record<ActionCode, [string, string]> = {
  ACTION_WORK_NOW: ["Fazer contato comercial", "Entrar em contato com a oportunidade e registrar o resultado."],
  ACTION_ENRICH_ACCOUNT: ["Completar dados da conta", "Buscar as informações ausentes antes da próxima abordagem."],
  ACTION_QUALIFY_PROSPECTING: ["Qualificar oportunidade", "Validar necessidade, contato responsável, contexto e prazo."],
  ACTION_LAST_CONTACT_BEFORE_FREEZE: ["Fazer última tentativa de contato", "Revalidar interesse antes de congelar ou encerrar."],
};

const SIGNAL_LABELS: Record<SystemSignal, [string, string]> = {
  ACCOUNT_MISSING: ["Conta sem cadastro", "#e76b83"],
  AGE_ONLY_FALLBACK: ["Estimativa por tempo", "#ecaa43"],
  OUT_OF_COVERAGE_AGE: ["Fora da cobertura temporal", "#e7884a"],
  PROSPECTING_NO_ENGAGE_DATE: ["Aguardando negociação", "#7192d9"],
  LOW_SUPPORT_AGE_121_138: ["Histórico limitado", "#b387df"],
  MODEL_FULL: ["Modelo completo", "#54a985"],
};

function required(value: string, label: string, max = 200): string {
  const text = value.trim();
  if (!text || text.length > max) throw new Error(`${label} deve ter entre 1 e ${max} caracteres.`);
  return text;
}

function optionalDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error("Data inválida.");
  return value;
}

function stageForDeal(deal: Deal, stage: PipelineStage): DealStage {
  if (stage.id === "prospecting") return "Prospecting";
  if (stage.id === "engaging") return "Engaging";
  return deal.engageDate ? "Engaging" : "Prospecting";
}

function applyStages(baseDeals: Deal[], store: CrmStore): CrmDeal[] {
  const stageMap = new Map(store.stages.list().map((stage) => [stage.id, stage]));
  const overrides = store.deals.listOverrides();
  const historical = baseDeals.map((deal): CrmDeal => {
    const override = overrides.get(deal.id);
    const stageId = override ? (override.stageId ?? DEFAULT_STAGE_ID[deal.stage] ?? null) : DEFAULT_STAGE_ID[deal.stage] ?? null;
    const engageDate = override?.engageDate ?? deal.engageDate;
    const stage = stageId ? stageMap.get(stageId) : null;
    return { ...deal, rawStage: deal.stage, engageDate, stageId, funnelId: override?.funnelId ?? DEFAULT_FUNNEL_ID,
      status: override?.status ?? historicalStatus(deal.stage), stage: stage ? stageForDeal({ ...deal, engageDate }, stage) : deal.stage };
  });
  return [...historical, ...store.deals.listNew().map((deal) => {
    const stage = deal.stageId ? stageMap.get(deal.stageId) : null;
    return stage ? { ...deal, rawStage: deal.rawStage ?? deal.stage, stage: stageForDeal(deal, stage) } : { ...deal, rawStage: deal.rawStage ?? deal.stage };
  })];
}

function systemTags(store: CrmStore, dealId: string, score: PriorityResult | null): void {
  const systemIds = new Set(store.tags.list().filter((tag) => tag.type === "SYSTEM").map((tag) => tag.id));
  for (const link of store.tags.listLinks()) if (link.dealId === dealId && systemIds.has(link.tagId)) store.tags.detach(link);
  for (const signal of score?.systemSignals ?? []) store.tags.attach({ dealId, tagId: signal });
}

function initialTask(store: CrmStore, dealId: string, score: PriorityResult | null): void {
  if (!score) return;
  const [title, description] = ACTION_TASK[score.action];
  const now = new Date().toISOString();
  const exists = store.tasks.list().some((task) => task.dealId === dealId && task.source === "SYSTEM_ACTION");
  if (!exists) store.tasks.save({ id: randomUUID(), dealId, title, description, dueAt: null, status: "PENDING", source: "SYSTEM_ACTION", actionCode: score.action, createdAt: now, updatedAt: now, completedAt: null });
}

function seedOnce(store: CrmStore, deals: CrmDeal[], scores: ScoresByDeal): void {
  if (store.getMeta("operations_seed_v1")) return;
  store.transaction(() => {
    if (store.getMeta("operations_seed_v1")) return;
    const now = new Date().toISOString();
    for (const [id, [name, color]] of Object.entries(SIGNAL_LABELS)) store.tags.save({ id, name, color, type: "SYSTEM", createdAt: now });
    for (const deal of deals) {
      const score = scores[deal.id];
      if (!score) continue;
      const [title, description] = ACTION_TASK[score.action];
      store.tasks.save({ id: randomUUID(), dealId: deal.id, title, description, dueAt: null, status: "PENDING", source: "SYSTEM_ACTION", actionCode: score.action, createdAt: now, updatedAt: now, completedAt: null });
      for (const signal of score.systemSignals) store.tags.attach({ dealId: deal.id, tagId: signal });
    }
    store.setMeta("operations_seed_v1", now);
  });
}

export function getCrmSnapshot(baseDeals: Deal[], store: CrmStore): CrmSnapshot {
  const deals = applyStages(baseDeals, store);
  const scores = scoreSnapshot(deals.filter(isOpenDeal));
  seedOnce(store, deals, scores);
  return { deals, scores, tiers: tierSnapshot(deals), tasks: store.tasks.list(), tags: store.tags.list(), dealTags: store.tags.listLinks(), notes: store.notes.list(), stages: store.stages.list(), funnels: store.funnels.list() };
}

export function performCrmOperation(baseDeals: Deal[], store: CrmStore, operation: CrmOperation): CrmSnapshot {
  const current = getCrmSnapshot(baseDeals, store);
  const dealIds = new Set(current.deals.map((deal) => deal.id));
  const mustDeal = (dealId: string) => { if (!dealIds.has(dealId)) throw new Error("Oportunidade não encontrada."); };
  const mustTask = (id: string) => { const task = store.tasks.find(id); if (!task) throw new Error("Tarefa não encontrada."); return task; };
  const mustNote = (id: string) => { const note = store.notes.find(id); if (!note) throw new Error("Anotação não encontrada."); return note; };
  const mustUserTag = (id: string) => { const tag = store.tags.find(id); if (!tag || tag.type !== "USER") throw new Error("Etiqueta protegida ou não encontrada."); return tag; };
  const now = new Date().toISOString();
  switch (operation.kind) {
    case "funnel.create": { store.funnels.save({ id: randomUUID(), name: required(operation.name, "Funil", 60), createdAt: now, updatedAt: now }); break; }
    case "funnel.update": { const funnel = store.funnels.find(operation.id); if (!funnel) throw new Error("Funil não encontrado."); store.funnels.save({ ...funnel, name: required(operation.name, "Funil", 60), updatedAt: now }); break; }
    case "task.create": {
      mustDeal(operation.dealId);
      store.tasks.save({ id: randomUUID(), dealId: operation.dealId, title: required(operation.title, "Título"), description: operation.description?.trim() || null, dueAt: optionalDate(operation.dueAt), status: "PENDING", source: "USER", actionCode: null, createdAt: now, updatedAt: now, completedAt: null });
      break;
    }
    case "task.update": { const task = mustTask(operation.id); store.tasks.save({ ...task, title: required(operation.title, "Título"), description: operation.description?.trim() || null, dueAt: optionalDate(operation.dueAt), updatedAt: now }); break; }
    case "task.status": { const task = mustTask(operation.id); if (operation.status !== "PENDING" && operation.status !== "COMPLETED") throw new Error("Status inválido."); store.tasks.save({ ...task, status: operation.status, completedAt: operation.status === "COMPLETED" ? now : null, updatedAt: now }); break; }
    case "task.delete": mustTask(operation.id); store.tasks.delete(operation.id); break;
    case "tag.create": {
      mustDeal(operation.dealId);
      const name = required(operation.name, "Etiqueta", 60);
      const tag: Tag = { id: randomUUID(), name, color: /^#[0-9a-fA-F]{6}$/.test(operation.color) ? operation.color : "#5b83c5", type: "USER", createdAt: now };
      store.transaction(() => { store.tags.save(tag); store.tags.attach({ dealId: operation.dealId, tagId: tag.id }); });
      break;
    }
    case "tag.update": { const tag = mustUserTag(operation.id); store.tags.save({ ...tag, name: required(operation.name, "Etiqueta", 60), color: /^#[0-9a-fA-F]{6}$/.test(operation.color) ? operation.color : tag.color }); break; }
    case "tag.attach": mustDeal(operation.dealId); mustUserTag(operation.tagId); store.tags.attach({ dealId: operation.dealId, tagId: operation.tagId }); break;
    case "tag.detach": mustDeal(operation.dealId); mustUserTag(operation.tagId); store.tags.detach({ dealId: operation.dealId, tagId: operation.tagId }); break;
    case "note.create": mustDeal(operation.dealId); store.notes.save({ id: randomUUID(), dealId: operation.dealId, content: required(operation.content, "Anotação", 5000), createdAt: now, updatedAt: now }); break;
    case "note.update": { const note = mustNote(operation.id); store.notes.save({ ...note, content: required(operation.content, "Anotação", 5000), updatedAt: now }); break; }
    case "note.delete": mustNote(operation.id); store.notes.delete(operation.id); break;
    case "stage.create": {
      if (!store.funnels.find(operation.funnelId)) throw new Error("Funil não encontrado.");
      const orders = current.stages.filter((stage) => stage.funnelId === operation.funnelId).map((stage) => stage.order);
      store.stages.save({ id: randomUUID(), funnelId: operation.funnelId, name: required(operation.name, "Etapa", 60), order: Math.max(-1, ...orders) + 1, category: "OPEN", isDefault: false, active: true, createdAt: now });
      break;
    }
    case "stage.update": { const stage = store.stages.find(operation.id); if (!stage) throw new Error("Etapa não encontrada."); store.stages.save({ ...stage, name: required(operation.name, "Etapa", 60) }); break; }
    case "stage.move": {
      const target = store.stages.find(operation.id);
      const stages = current.stages.filter((stage) => stage.active && stage.category === "OPEN" && stage.funnelId === target?.funnelId);
      const index = stages.findIndex((stage) => stage.id === operation.id);
      const other = stages[index + operation.direction];
      if (index < 0 || !other) throw new Error("Não é possível mover essa etapa.");
      store.transaction(() => { store.stages.save({ ...stages[index], order: other.order }); store.stages.save({ ...other, order: stages[index].order }); });
      break;
    }
    case "stage.delete": {
      const stage = store.stages.find(operation.id);
      if (!stage || stage.isDefault) throw new Error("Etapa padrão não pode ser excluída.");
      if (current.deals.some((deal) => deal.stageId === stage.id)) throw new Error("Mova os negócios desta etapa antes de excluí-la.");
      store.stages.delete(stage.id);
      break;
    }
    case "deal.stage": {
      mustDeal(operation.dealId);
      const stage = store.stages.find(operation.stageId);
      if (!stage?.active || stage.category !== "OPEN") throw new Error("Etapa indisponível.");
      const deal = current.deals.find((item) => item.id === operation.dealId)!;
      const engageDate = optionalDate(operation.engageDate ?? deal.engageDate);
      if ((stage.id === "engaging" || (stage.category === "OPEN" && stage.id !== "prospecting" && engageDate)) && !engageDate) throw new Error("Informe a data de entrada em negociação.");
      if (engageDate && engageDate > scoringSnapshotDate) throw new Error(`O snapshot do modelo termina em ${scoringSnapshotDate}.`);
      if (deal.isNew) store.deals.saveNew({ ...deal, funnelId: stage.funnelId, stageId: stage.id, engageDate });
      else store.deals.saveOverride(deal.id, { stageId: stage.id, funnelId: stage.funnelId, engageDate, status: deal.status });
      const updated = { ...deal, stageId: stage.id, engageDate, stage: stageForDeal({ ...deal, engageDate }, stage) };
      const score = deal.status === "OPEN" ? scoreSnapshot([updated])[deal.id] ?? null : null;
      store.transaction(() => { systemTags(store, deal.id, score); initialTask(store, deal.id, score); });
      break;
    }
    case "deal.status": {
      mustDeal(operation.dealId);
      if (!["OPEN", "WON", "LOST"].includes(operation.status)) throw new Error("Status inválido.");
      const deal = current.deals.find((item) => item.id === operation.dealId)!;
      if (operation.status === "OPEN" && !deal.stageId) throw new Error("Defina uma etapa antes de reabrir este negócio.");
      const reopenedDeal: CrmDeal = { ...deal, status: "OPEN" };
      const reopenedScore = operation.status === "OPEN" ? scoreSnapshot([reopenedDeal])[deal.id] ?? null : null;
      store.transaction(() => {
        if (deal.isNew) store.deals.saveNew({ ...deal, status: operation.status });
        else store.deals.saveOverride(deal.id, { stageId: deal.stageId, funnelId: deal.funnelId, engageDate: deal.engageDate, status: operation.status });
        if (operation.status === "OPEN") {
          systemTags(store, deal.id, reopenedScore);
          initialTask(store, deal.id, reopenedScore);
        }
      });
      break;
    }
    case "deal.create": {
      const input = operation.input;
      const stage = store.stages.find(input.stageId);
      if (!stage?.active || stage.category !== "OPEN" || stage.funnelId !== input.funnelId || !store.funnels.find(input.funnelId)) throw new Error("Nova oportunidade precisa de funil e etapa válidos.");
      const engageDate = optionalDate(input.engageDate);
      if (stage.id === "engaging" && !engageDate) throw new Error("Informe a data de entrada em negociação.");
      if (engageDate && engageDate > scoringSnapshotDate) throw new Error(`O snapshot do modelo termina em ${scoringSnapshotDate}.`);
      const account = required(input.account, "Conta");
      const product = required(input.product, "Produto");
      const salesPrice = Number(input.salesPrice);
      if (!Number.isFinite(salesPrice) || salesPrice <= 0) throw new Error("Valor do produto inválido.");
      const deal: CrmDeal = {
        id: `ARENA-${randomUUID().slice(0, 8).toUpperCase()}`, account, accountKnown: Boolean(input.accountKnown),
        sector: input.sector?.trim() || null, revenue: input.revenue, employees: input.employees,
        yearEstablished: input.yearEstablished, subsidiaryOf: input.subsidiaryOf?.trim() || null,
        officeLocation: input.officeLocation?.trim() || null,
        agent: required(input.agent, "Vendedor"), manager: input.manager?.trim() || "Não informado", region: input.region?.trim() || "Não informada",
        product, series: input.series || "Não informada", stage: "Prospecting", status: "OPEN", funnelId: stage.funnelId, stageId: stage.id,
        value: salesPrice, salesPrice, engageDate, closeDate: null, isNew: true,
      };
      deal.stage = stageForDeal(deal, stage);
      deal.rawStage = deal.stage;
      const score = scoreSnapshot([deal])[deal.id] ?? null;
      store.transaction(() => { store.deals.saveNew(deal); systemTags(store, deal.id, score); initialTask(store, deal.id, score); });
      break;
    }
  }
  return getCrmSnapshot(baseDeals, store);
}

export async function withCrmStore<T>(work: (store: CrmStore) => T): Promise<T> {
  const store = createCrmStore();
  try { return work(store); } finally { store.close(); }
}

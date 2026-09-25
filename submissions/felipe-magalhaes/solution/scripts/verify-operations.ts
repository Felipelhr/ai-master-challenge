import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { Deal } from "../src/domain/deals/deal";
import { nextTask, nextTasksByDeal } from "../src/domain/tasks/next-task";
import { createCrmStore } from "../src/repositories/sqlite/crm-store";
import { getCrmSnapshot, performCrmOperation } from "../src/services/crm/crm-service";

const dir = path.join(process.cwd(), ".tmp"); mkdirSync(dir, { recursive: true });
const file = path.join(dir, `operations-${randomUUID()}.sqlite`);
const fixture: Deal = {
  id: "TEST-1", account: "Conta Teste", accountKnown: false, sector: null, revenue: null,
  employees: null, yearEstablished: null, subsidiaryOf: null, agent: "Felipe", manager: "Gerente", region: "Sudeste",
  product: "GTX Basic", series: "GTX", stage: "Engaging", value: 1000, salesPrice: 1000,
  engageDate: "2017-12-01", closeDate: null,
};
let store = createCrmStore(file);
const base = [fixture];
let state = getCrmSnapshot(base, store);
assert.equal(state.tasks.length, 1);
assert.equal(state.tasks[0].source, "SYSTEM_ACTION");
assert(state.tags.some((tag) => tag.type === "SYSTEM"));
getCrmSnapshot(base, store);
assert.equal(store.tasks.list().length, 1, "tarefa automática idempotente");

state = performCrmOperation(base, store, { kind: "task.create", dealId: fixture.id, title: "Ligar", description: "Primeira ligação", dueAt: "2017-12-20" });
const task = state.tasks.find((item) => item.title === "Ligar")!;
state = performCrmOperation(base, store, { kind: "task.update", id: task.id, title: "Ligar amanhã", description: "Atualizado", dueAt: "2017-12-21" });
assert.equal(state.tasks.find((item) => item.id === task.id)?.title, "Ligar amanhã");
assert.equal(nextTask(state.tasks.filter((item) => item.dealId === fixture.id))?.id, task.id);
assert.equal(nextTasksByDeal(state.tasks)[fixture.id]?.id, task.id);
assert.equal(nextTask([{ ...task, id: "future", dueAt: "2099-01-01" }, { ...task, id: "overdue", dueAt: "2017-12-01" }, { ...task, id: "undated", dueAt: null }])?.id, "overdue");
state = performCrmOperation(base, store, { kind: "task.status", id: task.id, status: "COMPLETED" });
assert.equal(state.tasks.find((item) => item.id === task.id)?.status, "COMPLETED");
state = performCrmOperation(base, store, { kind: "task.status", id: task.id, status: "PENDING" });
assert.equal(state.tasks.find((item) => item.id === task.id)?.completedAt, null);
state = performCrmOperation(base, store, { kind: "task.delete", id: task.id });
assert(!state.tasks.some((item) => item.id === task.id));

state = performCrmOperation(base, store, { kind: "tag.create", dealId: fixture.id, name: "VIP", color: "#ff0000" });
const userTag = state.tags.find((tag) => tag.name === "VIP")!;
assert(state.dealTags.some((link) => link.tagId === userTag.id));
state = performCrmOperation(base, store, { kind: "tag.detach", dealId: fixture.id, tagId: userTag.id });
assert(!state.dealTags.some((link) => link.tagId === userTag.id));
state = performCrmOperation(base, store, { kind: "tag.attach", dealId: fixture.id, tagId: userTag.id });
assert(state.dealTags.some((link) => link.tagId === userTag.id));
assert.throws(() => performCrmOperation(base, store, { kind: "tag.detach", dealId: fixture.id, tagId: "ACCOUNT_MISSING" }), /protegida/);

state = performCrmOperation(base, store, { kind: "note.create", dealId: fixture.id, content: "Contexto" });
const note = state.notes[0];
state = performCrmOperation(base, store, { kind: "note.update", id: note.id, content: "Contexto editado" });
assert.equal(state.notes[0].content, "Contexto editado");
state = performCrmOperation(base, store, { kind: "note.delete", id: note.id });
assert.equal(state.notes.length, 0);

state = performCrmOperation(base, store, { kind: "stage.create", name: "Qualificação", funnelId: "default" });
const custom = state.stages.find((stage) => stage.name === "Qualificação")!;
state = performCrmOperation(base, store, { kind: "deal.stage", dealId: fixture.id, stageId: custom.id });
assert.equal(state.deals[0].stageId, custom.id);
assert.throws(() => performCrmOperation(base, store, { kind: "stage.delete", id: custom.id }), /Mova os negócios/);
state = performCrmOperation(base, store, { kind: "deal.stage", dealId: fixture.id, stageId: "prospecting" });
assert.equal(state.tasks.filter((item) => item.source === "SYSTEM_ACTION").length, 1, "etapa não duplica tarefa inicial");
state = performCrmOperation(base, store, { kind: "deal.stage", dealId: fixture.id, stageId: custom.id, engageDate: "2017-12-15" });
assert.equal(state.deals[0].engageDate, "2017-12-15");
state = performCrmOperation(base, store, { kind: "deal.create", input: {
  account: "Nova Conta", product: "GTX Basic", series: "GTX", salesPrice: 550, agent: "Felipe", manager: "Gerente", region: "Sudeste",
  funnelId: "default", stageId: "prospecting", engageDate: null, accountKnown: false, sector: null, revenue: null, employees: null, yearEstablished: null, subsidiaryOf: null,
} });
const newDeal = state.deals.find((deal) => deal.isNew)!;
assert(state.scores[newDeal.id], "nova oportunidade recebe score");
assert(state.tasks.some((item) => item.dealId === newDeal.id && item.source === "SYSTEM_ACTION"), "nova oportunidade recebe tarefa");
assert(state.dealTags.some((link) => link.dealId === newDeal.id && link.tagId === "PROSPECTING_NO_ENGAGE_DATE"), "nova oportunidade recebe tag factual");
store.close();
store = createCrmStore(file);
state = getCrmSnapshot(base, store);
assert.equal(state.deals[0].stageId, custom.id, "reload preserva etapa");
assert.equal(state.deals[0].engageDate, "2017-12-15", "reload preserva data operacional");
assert(state.dealTags.some((link) => link.tagId === userTag.id), "reload preserva tag");
assert.equal(state.tasks.filter((item) => item.dealId === fixture.id).length, 1, "reload preserva tarefa sem duplicar");
assert(state.deals.some((deal) => deal.id === newDeal.id), "reload preserva nova oportunidade");
store.close();
for (const suffix of ["", "-wal", "-shm"]) { try { unlinkSync(file + suffix); } catch { /* SQLite may remove sidecars itself */ } }
console.log("TESTE 1: persistência/domínio PASS");

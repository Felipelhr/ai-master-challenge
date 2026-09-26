import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { csvDealsRepository } from "../src/repositories/deals/csv-deals-repository";
import { createCrmStore } from "../src/repositories/sqlite/crm-store";
import { getCrmSnapshot, performCrmOperation } from "../src/services/crm/crm-service";
import { displayStageId, FINALIZATION_STAGE_ID, finalizationStage } from "../src/domain/pipeline/stage";
import { scoreNewOpportunity } from "../src/services/scoring/score-snapshot";
import { rankTopFive } from "../src/services/priorities/rank-top-five";
import { emptyPriorityFilters } from "../src/services/priorities/rank-top-five";
import { dashboardMetrics } from "../src/services/dashboard/dashboard-metrics";
import { priorityDigest } from "../src/services/email/priority-digest";
import { createEmailRepository } from "../src/repositories/email/sqlite-email-repository";
import { saveEmailSchedule } from "../src/services/email/email-service";
import type { PriorityFilters } from "../src/services/priorities/rank-top-five";

const folder = mkdtempSync(path.join(os.tmpdir(),"arena-product-model-"));
try {
  const base = await csvDealsRepository.list();
  const file = path.join(folder,"legacy.sqlite");
  const legacy = new DatabaseSync(file);
  legacy.exec(`CREATE TABLE deal_overrides(deal_id TEXT PRIMARY KEY, stage_id TEXT NOT NULL, engage_date TEXT);
    CREATE TABLE pipeline_stages(id TEXT PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL,category TEXT NOT NULL,is_default INTEGER NOT NULL,active INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE new_deals(id TEXT PRIMARY KEY,payload TEXT NOT NULL);`);
  legacy.prepare("INSERT INTO pipeline_stages VALUES ('lost','Perdido',3,'LOST',1,1,'2026-09-24T00:00:00Z')").run();
  legacy.prepare("INSERT INTO pipeline_stages VALUES ('custom-old','Qualificação',4,'OPEN',0,1,'2026-09-24T00:00:00Z')").run();
  const changed = base.find((deal) => deal.stage === "Engaging")!;
  legacy.prepare("INSERT INTO deal_overrides VALUES (?, 'lost', ?)").run(changed.id,changed.engageDate);
  legacy.close();
  let store = createCrmStore(file);
  let snapshot = getCrmSnapshot(base,store);
  assert.equal(snapshot.funnels.find((item) => item.id === "default")?.name,"Pipeline Comercial");
  assert.equal(snapshot.stages.find((item) => item.id === "custom-old")?.funnelId,"default");
  assert(snapshot.stages.filter((item) => item.active).every((item) => item.category === "OPEN"));
  assert.equal(snapshot.deals.length,8800);
  assert.equal(snapshot.deals.filter((deal) => deal.status === "OPEN").length,2088);
  assert.equal(Object.keys(snapshot.scores).length,2088);
  const migrated = snapshot.deals.find((deal) => deal.id === changed.id)!;
  assert.equal(migrated.status,"LOST"); assert.equal(migrated.stageId,"engaging"); assert.equal(migrated.rawStage,"Engaging");
  const historicWon = snapshot.deals.find((deal) => deal.rawStage === "Won")!;
  assert.equal(historicWon.status,"WON"); assert.equal(historicWon.stageId,null);
  assert.equal(snapshot.deals.find((deal) => deal.id === historicWon.id)?.rawStage,"Won");
  assert.equal(rankTopFive(snapshot.deals,snapshot.scores,snapshot.tiers,snapshot.dealTags).eligibleCount,2088);
  assert.throws(() => performCrmOperation(base,store,{ kind:"deal.status",dealId:historicWon.id,status:"OPEN" }),/Defina uma etapa/);
  snapshot = performCrmOperation(base,store,{ kind:"funnel.create", name:"Canal Parceiros" });
  const funnel = snapshot.funnels.find((item) => item.name === "Canal Parceiros")!;
  snapshot = performCrmOperation(base,store,{ kind:"funnel.update", id:funnel.id, name:"Parcerias" });
  assert.equal(snapshot.funnels.find((item) => item.id === funnel.id)?.name,"Parcerias");
  snapshot = performCrmOperation(base,store,{ kind:"stage.create", funnelId:funnel.id, name:"Contato inicial" });
  const stage = snapshot.stages.find((item) => item.name === "Contato inicial")!;
  assert.equal(stage.funnelId,funnel.id);
  snapshot = performCrmOperation(base,store,{ kind:"deal.create", input:{ account:"Nova conta",product:"GTX Basic",series:"GTX",salesPrice:550,agent:"Felipe",manager:"Gestor",region:"Sudeste",funnelId:funnel.id,stageId:stage.id,engageDate:null,accountKnown:false,sector:null,revenue:null,employees:null,yearEstablished:null,subsidiaryOf:null } });
  const created = snapshot.deals.find((deal) => deal.isNew)!;
  assert.equal(created.status,"OPEN"); assert.equal(created.funnelId,funnel.id); assert.equal(created.stageId,stage.id);
  assert(snapshot.scores[created.id]);
  snapshot = performCrmOperation(base,store,{ kind:"deal.status",dealId:created.id,status:"WON" });
  assert.equal(snapshot.deals.find((deal) => deal.id === created.id)?.stageId,stage.id);
  assert.equal(snapshot.deals.find((deal) => deal.id === created.id)?.status,"WON");
  assert.equal(snapshot.scores[created.id],undefined);
  assert.equal(displayStageId(snapshot.deals.find((deal) => deal.id === created.id)!),FINALIZATION_STAGE_ID);
  assert(!rankTopFive(snapshot.deals,snapshot.scores,snapshot.tiers,snapshot.dealTags).queues.flatMap((group) => group.items).some((deal) => deal.id === created.id));
  snapshot = performCrmOperation(base,store,{ kind:"deal.status",dealId:created.id,status:"LOST" });
  assert.equal(snapshot.deals.find((deal) => deal.id === created.id)?.stageId,stage.id);
  snapshot = performCrmOperation(base,store,{ kind:"deal.status",dealId:created.id,status:"OPEN" });
  assert(snapshot.scores[created.id]);
  assert.equal(displayStageId(snapshot.deals.find((deal) => deal.id === created.id)!),stage.id);
  assert.throws(() => performCrmOperation(base,store,{ kind:"stage.delete",id:stage.id }),/Mova os negócios/);
  store.close(); store = createCrmStore(file);
  snapshot = getCrmSnapshot(base,store);
  assert.equal(snapshot.deals.find((deal) => deal.id === created.id)?.status,"OPEN");
  assert.equal(snapshot.deals.find((deal) => deal.id === created.id)?.stageId,stage.id);
  assert.equal(snapshot.funnels.find((item) => item.id === funnel.id)?.name,"Parcerias");
  store.close();
  const clean = createCrmStore(":memory:");
  const baseline = getCrmSnapshot(base,clean);
  assert.equal(baseline.deals.filter((deal) => deal.status === "OPEN").length,2089);
  assert.equal(Object.keys(baseline.scores).length,2089);
  assert(baseline.deals.filter((deal) => deal.status !== "OPEN").every((deal) => deal.stageId === null));
  assert.equal(finalizationStage("default").name,"Finalização");
  assert.equal(baseline.deals.filter((deal) => deal.status === "OPEN" && displayStageId(deal) === "prospecting").length,500);
  assert.equal(baseline.deals.filter((deal) => deal.status === "OPEN" && displayStageId(deal) === "engaging").length,1589);
  assert.equal(baseline.deals.filter((deal) => deal.status === "WON" && displayStageId(deal) === FINALIZATION_STAGE_ID).length,4238);
  assert.equal(baseline.deals.filter((deal) => deal.status === "LOST" && displayStageId(deal) === FINALIZATION_STAGE_ID).length,2473);
  assert.equal(baseline.deals.filter((deal) => displayStageId(deal) !== null).length,8800);
  const dashboard = dashboardMetrics(baseline,emptyPriorityFilters,"all");
  const digest = priorityDigest(baseline,emptyPriorityFilters);
  assert.equal(dashboard.open.count,2089);
  assert.deepEqual(digest.items.map((item) => item.id),dashboard.topFive.queues.flatMap((group) => group.items).map((deal) => deal.id));
  const oldScope = { ...emptyPriorityFilters } as Partial<PriorityFilters>;
  delete oldScope.funnelId;
  const emailRepo = createEmailRepository(path.join(folder,"schedule.sqlite"));
  const schedule = saveEmailSchedule(emailRepo,{ recipient:"test@example.invalid",enabled:false,frequency:"daily",sendTime:"08:00",weekday:null,dayOfMonth:null,scope:oldScope as PriorityFilters });
  const restored = emailRepo.findSchedule(schedule.id)!;
  assert.deepEqual(priorityDigest(baseline,restored.scope).items.map((item) => item.id),digest.items.map((item) => item.id));
  emailRepo.close();

  const source = base.find((deal) => deal.id === "SU1NDYXR")!;
  assert(source);
  const simulated = scoreNewOpportunity(source);
  assert.equal(simulated?.priorityScore,29);
  const createdWithSameInputs = performCrmOperation(base,clean,{ kind:"deal.create", input:{
    account:source.account, product:source.product, series:source.series, salesPrice:source.salesPrice,
    agent:source.agent, manager:source.manager, region:source.region, funnelId:"default",
    stageId:source.stage.toLowerCase(), engageDate:source.engageDate, accountKnown:source.accountKnown,
    sector:source.sector, revenue:source.revenue, employees:source.employees,
    yearEstablished:source.yearEstablished, subsidiaryOf:source.subsidiaryOf, officeLocation:source.officeLocation,
  } });
  const sameInputsDeal = createdWithSameInputs.deals.find((deal) => deal.isNew)!;
  assert.deepEqual(createdWithSameInputs.scores[sameInputsDeal.id],simulated,"simulação e cadastro devem ter a mesma inteligência");

  for (const closed of baseline.deals.filter((deal) => deal.status === "WON" || deal.status === "LOST").filter((deal,index,array) => array.findIndex((candidate) => candidate.status === deal.status) === index)) {
    const staged = performCrmOperation(base,clean,{ kind:"deal.stage", dealId:closed.id, stageId:"prospecting" });
    assert.equal(staged.scores[closed.id],undefined);
    const withUserTask = performCrmOperation(base,clean,{ kind:"task.create", dealId:closed.id, title:"Tarefa do vendedor", description:null, dueAt:null });
    const userTask = withUserTask.tasks.find((task) => task.dealId === closed.id && task.source === "USER")!;
    let reopened = performCrmOperation(base,clean,{ kind:"deal.status", dealId:closed.id, status:"OPEN" });
    assert.equal(reopened.scores[closed.id].scoreBasis,"PROSPECTING_VALUE");
    assert.deepEqual(reopened.dealTags.filter((link) => link.dealId === closed.id).map((link) => link.tagId),["PROSPECTING_NO_ENGAGE_DATE"]);
    assert.equal(reopened.tasks.filter((task) => task.dealId === closed.id && task.source === "SYSTEM_ACTION").length,1);
    assert(reopened.tasks.some((task) => task.id === userTask.id && task.source === "USER"));
    reopened = performCrmOperation(base,clean,{ kind:"deal.status", dealId:closed.id, status:"OPEN" });
    assert.equal(reopened.tasks.filter((task) => task.dealId === closed.id && task.source === "SYSTEM_ACTION").length,1);
    assert.equal(reopened.dealTags.filter((link) => link.dealId === closed.id && link.tagId === "PROSPECTING_NO_ENGAGE_DATE").length,1);
    assert(reopened.tasks.some((task) => task.id === userTask.id));
  }
  clean.close();
  console.log("TESTE 1 PASS: migração, Status/Etapa/Funil, históricos, Top 5 OPEN e 2.089 abertos.");
} finally { rmSync(folder,{recursive:true,force:true}); }

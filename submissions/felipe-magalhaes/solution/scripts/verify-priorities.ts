import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { ingestDeals, type AccountRow, type PipelineRow, type ProductRow, type TeamRow } from "../src/repositories/deals/ingest";
import { historicalStatus, isOpenDeal, type CrmDeal } from "../src/domain/deals/deal";
import { scoringEngine } from "../src/domain/scoring/engine";
import { CONFIDENCE_LABELS } from "../src/domain/scoring/labels";
import { calculateLeadTier, fixedPercentile, LEAD_TIERS } from "../src/domain/tiering/lead-tier";
import reference from "../src/domain/tiering/reference.json" with { type: "json" };
import { scoreSnapshot } from "../src/services/scoring/score-snapshot";
import { tierSnapshot } from "../src/services/tiering/tier-snapshot";
import { emptyPriorityFilters, rankTopFive, type PriorityFilters } from "../src/services/priorities/rank-top-five";
import { sortOperationalDeals } from "../src/services/crm/operational-order";

function rows<T>(filename: string): T[] {
  return parse(readFileSync(path.join(process.cwd(), "data", filename), "utf8"), { columns: true, skip_empty_lines: true, bom: true }) as T[];
}
const accounts = rows<AccountRow>("accounts.csv");
const base = ingestDeals(rows<PipelineRow>("sales_pipeline.csv"), accounts, rows<ProductRow>("products.csv"), rows<TeamRow>("sales_teams.csv"));
const deals: CrmDeal[] = base.map((deal) => ({ ...deal, status: historicalStatus(deal.stage), funnelId: "default", stageId: isOpenDeal(deal) ? deal.stage.toLowerCase() : null }));
const scores = scoreSnapshot(deals);
const tiers = tierSnapshot(deals);
const open = deals.filter(isOpenDeal);

// Bloco 1 — Lead Tier / evidência.
assert.equal(reference.baselineDeals, 8800);
assert.equal(reference.baselineAccounts, 85);
assert.deepEqual(reference.price, base.map((deal) => deal.salesPrice).sort((a, b) => a - b));
assert.deepEqual(reference.revenue, accounts.map((row) => Number(row.revenue)).sort((a, b) => a - b));
assert.deepEqual(reference.employees, accounts.map((row) => Number(row.employees)).sort((a, b) => a - b));
const sample = open.find((deal) => deal.accountKnown)!;
const tier = calculateLeadTier(sample);
assert.equal(tier.tier, calculateLeadTier(sample).tier);
assert.equal(tier.index, 100 * (0.50 * tier.components.pricePercentile + 0.25 * tier.components.revenuePercentile + 0.10 * tier.components.employeesPercentile + 0.15 * tier.components.completenessRatio));
assert.equal(calculateLeadTier({ ...sample, subsidiaryOf: null }).index, calculateLeadTier({ ...sample, subsidiaryOf: "Controladora" }).index);
const missingSize = calculateLeadTier({ ...sample, revenue: null, employees: null });
assert.equal(missingSize.components.revenuePercentile, 0.5);
assert.equal(missingSize.components.employeesPercentile, 0.5);
assert.equal(fixedPercentile(reference.revenue, null), 0.5);
const scoreBefore = scoringEngine.score(sample);
calculateLeadTier(sample);
assert.deepEqual(scoringEngine.score(sample), scoreBefore);
const newDeal = { ...sample, id: "NOVA", revenue: null, employees: null, officeLocation: null };
calculateLeadTier(newDeal);
assert.equal(calculateLeadTier(sample).index, tier.index, "nova oportunidade não muda referência");
assert.equal(CONFIDENCE_LABELS.LOW, "Menor");
assert.equal(CONFIDENCE_LABELS.MEDIUM, "Maior");
const distribution = Object.fromEntries(LEAD_TIERS.map((label) => [label, open.filter((deal) => tiers[deal.id].tier === label).length]));
assert.equal(Object.values(distribution).reduce((sum, value) => sum + value, 0), 2089);
console.log(`TESTE 1: Lead Tier/evidência PASS; distribuição=${JSON.stringify(distribution)}`);

// Bloco 2 — ranking e filtros do produto.
const empty = rankTopFive(deals, scores, tiers, []);
assert.equal(empty.eligibleCount, 2089);
assert.equal(empty.items.length, 5);
assert(empty.items.every(isOpenDeal));
for (let index = 1; index < empty.items.length; index++) assert(scores[empty.items[index - 1].id].priorityScore >= scores[empty.items[index].id].priorityScore);
assert.deepEqual(empty.items.map((deal) => deal.id),sortOperationalDeals(open,scores).slice(0,5).map((deal) => deal.id));
const example = open.slice(0,3).map((deal,index) => ({ ...deal, id: ["value-20k","value-80k","value-500k"][index], value: [20000,80000,500000][index] }));
const exampleScores = {
  "value-20k": { ...scores[open[0].id], priorityScore: 100, priorityValue: 900000 },
  "value-80k": { ...scores[open[1].id], priorityScore: 100, priorityValue: 1 },
  "value-500k": { ...scores[open[2].id], priorityScore: 99, priorityValue: 999999 },
};
assert.deepEqual(rankTopFive(example,exampleScores,{},[]).items.map((deal) => deal.id),["value-80k","value-20k","value-500k"]);
const referenceDeal = empty.items[0];
const sectorDeal = open.find((deal) => Boolean(deal.sector))!;
const tagId = scores[referenceDeal.id].systemSignals[0];
const links = open.flatMap((deal) => scores[deal.id].systemSignals.map((signal) => ({ dealId: deal.id, tagId: signal })));
const cases: [keyof PriorityFilters, string, (deal: CrmDeal) => boolean][] = [
  ["agent", referenceDeal.agent, (deal) => deal.agent === referenceDeal.agent],
  ["manager", referenceDeal.manager, (deal) => deal.manager === referenceDeal.manager],
  ["region", referenceDeal.region, (deal) => deal.region === referenceDeal.region],
  ["sector", sectorDeal.sector!, (deal) => deal.sector === sectorDeal.sector],
  ["product", referenceDeal.product, (deal) => deal.product === referenceDeal.product],
  ["stageId", referenceDeal.stageId!, (deal) => deal.stageId === referenceDeal.stageId],
  ["leadTier", tiers[referenceDeal.id].tier, (deal) => tiers[deal.id].tier === tiers[referenceDeal.id].tier],
  ["confidence", scores[referenceDeal.id].confidence, (deal) => scores[deal.id].confidence === scores[referenceDeal.id].confidence],
  ["action", scores[referenceDeal.id].action, (deal) => scores[deal.id].action === scores[referenceDeal.id].action],
  ["tagId", tagId, (deal) => scores[deal.id].systemSignals.includes(tagId)],
];
for (const [key, value, predicate] of cases) {
  if (!value) continue;
  const result = rankTopFive(deals, scores, tiers, links, { ...emptyPriorityFilters, [key]: value });
  assert(result.eligibleCount > 0, `${key} deve retornar candidatos`);
  assert(result.items.every(predicate), `${key} deve filtrar antes do ranking`);
}
const combined = rankTopFive(deals, scores, tiers, links, {
  ...emptyPriorityFilters, agent: referenceDeal.agent, manager: referenceDeal.manager,
  region: referenceDeal.region, product: referenceDeal.product, leadTier: tiers[referenceDeal.id].tier,
  confidence: scores[referenceDeal.id].confidence, action: scores[referenceDeal.id].action,
  minScore: String(scores[referenceDeal.id].priorityScore), maxScore: String(scores[referenceDeal.id].priorityScore),
});
assert(combined.items.some((deal) => deal.id === referenceDeal.id));
assert(combined.items.every((deal) => deal.agent === referenceDeal.agent && deal.product === referenceDeal.product));
assert(!links.some((link) => String(link.tagId) === "TOP_5_SELLER"));
console.log(`TESTE 2: Top 5/filtros PASS; padrão=${empty.items.map((deal) => deal.id).join(",")}`);

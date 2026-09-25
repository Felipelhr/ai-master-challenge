import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { ingestDeals, type AccountRow, type PipelineRow, type ProductRow, type TeamRow } from "../../src/repositories/deals/ingest";
import type { Deal } from "../../src/domain/deals/deal";
import { scoringEngine } from "../../src/domain/scoring/engine";
import { scoreSnapshot } from "../../src/services/scoring/score-snapshot";
import type { PriorityResult, ScoreBasis } from "../../src/domain/scoring/scoring-engine";

interface LegacyRow {
  priorityScore: number;
  scoreBasis: ScoreBasis;
  confidence: string;
  action: string;
  propensity30d: number | null;
  priorityValue: number | null;
  systemSignals: string[];
}

const readCsv = async <T>(name: string): Promise<T[]> => parse(await readFile(path.join(process.cwd(), "data", name), "utf8"), { columns: true, skip_empty_lines: true }) as T[];
const [pipeline, accounts, products, teams] = await Promise.all([
  readCsv<PipelineRow>("sales_pipeline.csv"), readCsv<AccountRow>("accounts.csv"),
  readCsv<ProductRow>("products.csv"), readCsv<TeamRow>("sales_teams.csv"),
]);
const artifact = JSON.parse(await readFile("src/domain/scoring/model-artifact.json", "utf8")) as {
  datasetSha256: string; trainingRows: number; numericFeatures: string[]; categoricalFeatures: string[];
};
const digest = createHash("sha256");
for (const filename of ["accounts.csv", "products.csv", "sales_pipeline.csv", "sales_teams.csv"]) {
  digest.update(filename);
  digest.update(await readFile(path.join(process.cwd(), "data", filename)));
}
assert.equal(artifact.datasetSha256, digest.digest("hex"), "Artefato e CSVs devem coincidir");
assert.equal(artifact.trainingRows, 10589);
assert.deepEqual(artifact.numericFeatures, ["age_days", "revenue", "employees", "company_age"]);
assert.deepEqual(artifact.categoricalFeatures, ["age_band", "product", "sector", "is_subsidiary"]);
const deals = ingestDeals(pipeline, accounts, products, teams);
const scores = scoreSnapshot(deals);
interface LegacyNewCase {
  name: string;
  input: {
    product: string; account: string | null; deal_stage: "Prospecting" | "Engaging"; engage_date: string | null;
    sector?: string; revenue?: number; employees?: number; year_established?: number; subsidiary_of?: string | null;
  };
  expected: LegacyRow;
}
const fixture = JSON.parse(await readFile("scripts/scoring/fixtures/legacy-snapshot.json", "utf8")) as { rows: Record<string, LegacyRow>; newCases: LegacyNewCase[] };
assert.equal(deals.length, 8800);
assert.equal(Object.keys(scores).length, 2089);
assert.equal(Object.keys(fixture.rows).length, 2089);

const counts: Record<ScoreBasis, number> = { MODEL_FULL: 0, AGE_ONLY_FALLBACK: 0, OUT_OF_COVERAGE_VALUE: 0, PROSPECTING_VALUE: 0 };
let maxPropensityDelta = 0;
let maxPriorityValueDelta = 0;
const differences: string[] = [];

for (const [id, actual] of Object.entries(scores)) {
  counts[actual.scoreBasis] += 1;
  const expected = fixture.rows[id];
  if (!expected) { differences.push(`${id}: ausente no legado`); continue; }
  const fields = ["priorityScore", "scoreBasis", "confidence", "action"] as const;
  for (const field of fields) {
    if (actual[field] !== expected[field]) differences.push(`${id}: ${field} ${actual[field]} != ${expected[field]}`);
  }
  if (actual.systemSignals.toSorted().join("|") !== expected.systemSignals.toSorted().join("|")) differences.push(`${id}: systemSignals`);
  if (expected.propensity30d === null) {
    if (actual.propensity30d !== undefined) differences.push(`${id}: propensity indevida`);
  } else if (actual.propensity30d === undefined) {
    differences.push(`${id}: propensity ausente`);
  } else {
    maxPropensityDelta = Math.max(maxPropensityDelta, Math.abs(actual.propensity30d - expected.propensity30d));
  }
  if (expected.priorityValue === null) {
    if (actual.priorityValue !== undefined) differences.push(`${id}: priorityValue indevido`);
  } else if (actual.priorityValue === undefined) {
    differences.push(`${id}: priorityValue ausente`);
  } else {
    maxPriorityValueDelta = Math.max(maxPriorityValueDelta, Math.abs(actual.priorityValue - expected.priorityValue));
  }
}

assert.deepEqual(counts, { MODEL_FULL: 89, AGE_ONLY_FALLBACK: 209, OUT_OF_COVERAGE_VALUE: 1291, PROSPECTING_VALUE: 500 });
assert.ok(deals.filter((deal) => deal.stage === "Won" || deal.stage === "Lost").every((deal) => scoringEngine.score(deal) === null));
assert.ok(Object.values(scores).every((result: PriorityResult) => result.priorityScore >= 0 && result.priorityScore <= 100));
assert.ok(maxPropensityDelta < 1e-10, `Diferença de propensity ${maxPropensityDelta}`);
assert.ok(maxPriorityValueDelta < 1e-7, `Diferença de valor ${maxPriorityValueDelta}`);

const known = deals.find((deal) => deal.id in scores && scores[deal.id].scoreBasis === "MODEL_FULL");
assert.ok(known);
const baseline = scoringEngine.score(known);
const changedNonFeatures = scoringEngine.score({ ...known, agent: "Outro", manager: "Outro", region: "Outra", closeDate: "2018-01-01", value: 999999 });
assert.deepEqual(changedNonFeatures, baseline, "Campos operacionais/futuros não devem alterar o score");

for (const testCase of fixture.newCases) {
  const { input, expected } = testCase;
  const product = products.find((row) => row.product === input.product);
  assert.ok(product);
  const deal: Deal = {
    id: "SIMULACAO", account: input.account ?? "Conta não informada", accountKnown: Boolean(input.account),
    sector: input.sector ?? null, revenue: input.revenue ?? null, employees: input.employees ?? null,
    yearEstablished: input.year_established ?? null, subsidiaryOf: input.subsidiary_of ?? null,
    agent: "Anna Snelling", manager: "", region: "", product: product.product, series: product.series,
    stage: input.deal_stage, engageDate: input.engage_date, closeDate: null,
    salesPrice: Number(product.sales_price), value: Number(product.sales_price),
  };
  const result = scoringEngine.score(deal, "reference");
  assert.ok(result, testCase.name);
  assert.equal(result.priorityScore, expected.priorityScore, `${testCase.name}: priorityScore`);
  assert.equal(result.scoreBasis, expected.scoreBasis, `${testCase.name}: scoreBasis`);
  assert.equal(result.confidence, expected.confidence, `${testCase.name}: confidence`);
  assert.equal(result.action, expected.action, `${testCase.name}: action`);
  if (expected.propensity30d === null) assert.equal(result.propensity30d, undefined);
  else assert.ok(result.propensity30d !== undefined && Math.abs(result.propensity30d - expected.propensity30d) < 1e-10);
  if (expected.priorityValue === null) assert.equal(result.priorityValue, undefined);
  else assert.ok(result.priorityValue !== undefined && Math.abs(result.priorityValue - expected.priorityValue) < 1e-7);
}

assert.equal(differences.length, 0, `Paridade divergente (${differences.length}):\n${differences.slice(0, 20).join("\n")}`);
console.log(`SCORING PASS: 2.089 abertos; cobertura 89/209/1.291/500; paridade exata de score/basis/confidence/action/signals; 4 simulações novas; Δpropensity=${maxPropensityDelta}; ΔpriorityValue=${maxPriorityValueDelta}.`);

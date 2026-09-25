import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { normalizeProduct } from "../src/domain/deals/normalize-product.ts";

const dataPath = (file) => path.join(process.cwd(), "data", file);
const readCsv = async (file) => parse(await readFile(dataPath(file), "utf8"), { columns: true, skip_empty_lines: true });
const [pipeline, accounts, products, teams] = await Promise.all([
  readCsv("sales_pipeline.csv"), readCsv("accounts.csv"), readCsv("products.csv"), readCsv("sales_teams.csv"),
]);

assert.equal(pipeline.length, 8800);
assert.equal(normalizeProduct("GTXPro"), "GTX Pro");
const productsByName = new Map(products.map((row) => [row.product, row]));
const accountsByName = new Map(accounts.map((row) => [row.account, row]));
const teamsByAgent = new Map(teams.map((row) => [row.sales_agent, row]));
const counts = { Prospecting: 0, Engaging: 0, Won: 0, Lost: 0 };
let normalizedCount = 0;

for (const row of pipeline) {
  assert.ok(row.opportunity_id);
  assert.ok(row.deal_stage in counts, `Etapa inválida: ${row.deal_stage}`);
  counts[row.deal_stage] += 1;
  const productName = normalizeProduct(row.product);
  const product = productsByName.get(productName);
  assert.ok(product, `Produto sem join: ${productName}`);
  assert.ok(Number(product.sales_price) > 0);
  if (row.deal_stage === "Won") assert.ok(Number(row.close_value) > 0, `Valor de ganho inválido: ${row.opportunity_id}`);
  assert.ok(teamsByAgent.has(row.sales_agent), `Vendedor sem join: ${row.sales_agent}`);
  if (row.account) assert.ok(accountsByName.has(row.account), `Conta sem join: ${row.account}`);
  if (row.product === "GTXPro") normalizedCount += 1;
}

assert.deepEqual(counts, { Prospecting: 500, Engaging: 1589, Won: 4238, Lost: 2473 });
assert.equal(normalizedCount, 1480);
assert.equal(Number(productsByName.get("GTX Pro").sales_price), 4821);
console.log("DADOS PASS: 8.800 oportunidades; joins de produto, equipe e contas; 1.480 GTXPro normalizados; etapas e preços validados.");

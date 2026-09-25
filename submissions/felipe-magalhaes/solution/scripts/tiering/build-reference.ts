import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { ingestDeals, type AccountRow, type PipelineRow, type ProductRow, type TeamRow } from "../../src/repositories/deals/ingest";

const root = process.cwd();
function rows<T>(name: string): T[] {
  return parse(readFileSync(path.join(root, "data", name), "utf8"), { columns: true, skip_empty_lines: true, bom: true }) as T[];
}
const accounts = rows<AccountRow>("accounts.csv");
const deals = ingestDeals(rows<PipelineRow>("sales_pipeline.csv"), accounts, rows<ProductRow>("products.csv"), rows<TeamRow>("sales_teams.csv"));
const sorted = (values: number[]) => values.sort((a, b) => a - b);
const reference = {
  source: "Official challenge CSVs, fixed at Bloco 4",
  baselineDeals: deals.length,
  baselineAccounts: accounts.length,
  price: sorted(deals.map((deal) => deal.salesPrice)),
  revenue: sorted(accounts.filter((row) => row.revenue !== "").map((row) => Number(row.revenue))),
  employees: sorted(accounts.filter((row) => row.employees !== "").map((row) => Number(row.employees))),
};
writeFileSync(path.join(root, "src", "domain", "tiering", "reference.json"), `${JSON.stringify(reference)}\n`);
console.log(`Tier reference: ${reference.baselineDeals} deals, ${reference.baselineAccounts} accounts`);

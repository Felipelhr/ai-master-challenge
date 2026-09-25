import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { Deal } from "@/domain/deals/deal";
import type { DealsRepository } from "./deals-repository";
import { ingestDeals, type AccountRow, type PipelineRow, type ProductRow, type TeamRow } from "./ingest";

async function readCsv<T>(filename: string): Promise<T[]> {
  const csv = await readFile(path.join(process.cwd(), "data", filename), "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as T[];
}

let cachedDeals: Promise<Deal[]> | null = null;

async function loadDeals(): Promise<Deal[]> {
  const [pipeline, accounts, products, teams] = await Promise.all([
    readCsv<PipelineRow>("sales_pipeline.csv"),
    readCsv<AccountRow>("accounts.csv"),
    readCsv<ProductRow>("products.csv"),
    readCsv<TeamRow>("sales_teams.csv"),
  ]);
  return ingestDeals(pipeline, accounts, products, teams);
}

export const csvDealsRepository: DealsRepository = {
  list() {
    cachedDeals ??= loadDeals();
    return cachedDeals;
  },
  async findById(id) {
    return (await this.list()).find((deal) => deal.id === id) ?? null;
  },
};

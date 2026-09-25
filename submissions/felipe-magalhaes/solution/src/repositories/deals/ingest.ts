import { DEAL_STAGES, type Deal, type DealStage } from "@/domain/deals/deal";
import { normalizeProduct } from "@/domain/deals/normalize-product";

export interface PipelineRow {
  opportunity_id: string;
  sales_agent: string;
  product: string;
  account: string;
  deal_stage: string;
  engage_date: string;
  close_date: string;
  close_value: string;
}

export interface AccountRow {
  account: string;
  sector: string;
  revenue: string;
  employees: string;
  year_established: string;
  subsidiary_of: string;
  office_location: string;
}

export interface ProductRow {
  product: string;
  series: string;
  sales_price: string;
}

export interface TeamRow {
  sales_agent: string;
  manager: string;
  regional_office: string;
}

function parseStage(value: string): DealStage {
  if (DEAL_STAGES.includes(value as DealStage)) return value as DealStage;
  throw new Error(`Etapa desconhecida no CSV: ${value}`);
}

export function ingestDeals(pipeline: PipelineRow[], accounts: AccountRow[], products: ProductRow[], teams: TeamRow[]): Deal[] {
  const accountByName = new Map(accounts.map((account) => [account.account, account]));
  const productByName = new Map(products.map((product) => [product.product, product]));
  const teamByAgent = new Map(teams.map((team) => [team.sales_agent, team]));

  return pipeline.map((row) => {
    const productName = normalizeProduct(row.product);
    const product = productByName.get(productName);
    const account = accountByName.get(row.account);
    const team = teamByAgent.get(row.sales_agent);
    if (!product) throw new Error(`Produto sem correspondência: ${productName}`);
    if (!team) throw new Error(`Vendedor sem correspondência: ${row.sales_agent}`);

    const closeValue = Number(row.close_value);
    return {
      id: row.opportunity_id,
      account: row.account || "Conta não informada",
      accountKnown: Boolean(account),
      sector: account?.sector ?? null,
      revenue: account?.revenue ? Number(account.revenue) : null,
      employees: account?.employees ? Number(account.employees) : null,
      yearEstablished: account?.year_established ? Number(account.year_established) : null,
      subsidiaryOf: account?.subsidiary_of || null,
      officeLocation: account?.office_location || null,
      agent: row.sales_agent,
      manager: team.manager,
      region: team.regional_office,
      product: productName,
      series: product.series,
      stage: parseStage(row.deal_stage),
      value: row.deal_stage === "Won" && row.close_value ? closeValue : Number(product.sales_price),
      salesPrice: Number(product.sales_price),
      engageDate: row.engage_date || null,
      closeDate: row.close_date || null,
    } satisfies Deal;
  });
}

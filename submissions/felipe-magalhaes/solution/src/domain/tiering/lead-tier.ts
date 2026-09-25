import type { Deal } from "@/domain/deals/deal";
import reference from "./reference.json" with { type: "json" };

export const LEAD_TIERS = ["A+", "A", "B+", "B", "C", "D", "E"] as const;
export type LeadTier = (typeof LEAD_TIERS)[number];

export interface LeadTierResult {
  index: number;
  tier: LeadTier;
  components: {
    pricePercentile: number;
    revenuePercentile: number;
    employeesPercentile: number;
    completenessRatio: number;
    economicLabel: string;
    companySizeLabel: string;
    completenessLabel: string;
  };
}

function lowerBound(values: number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) { const middle = (low + high) >>> 1; if (values[middle] < target) low = middle + 1; else high = middle; }
  return low;
}
function upperBound(values: number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) { const middle = (low + high) >>> 1; if (values[middle] <= target) low = middle + 1; else high = middle; }
  return low;
}

export function fixedPercentile(values: number[], value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0.5;
  if (!values.length) return 0.5;
  return (lowerBound(values, value) + upperBound(values, value)) / (2 * values.length);
}

function band(value: number): string { return value >= 0.75 ? "alto" : value >= 0.4 ? "médio" : "baixo"; }
function tierFor(index: number): LeadTier {
  if (index >= 85) return "A+";
  if (index >= 75) return "A";
  if (index >= 65) return "B+";
  if (index >= 55) return "B";
  if (index >= 40) return "C";
  if (index >= 25) return "D";
  return "E";
}

export function calculateLeadTier(deal: Deal): LeadTierResult {
  const pricePercentile = fixedPercentile(reference.price, deal.salesPrice);
  const revenuePercentile = fixedPercentile(reference.revenue, deal.revenue);
  const employeesPercentile = fixedPercentile(reference.employees, deal.employees);
  const known = [
    Boolean(deal.account.trim() && deal.account !== "Conta não informada"),
    Boolean(deal.sector?.trim()),
    deal.yearEstablished !== null,
    deal.revenue !== null,
    deal.employees !== null,
    Boolean(deal.officeLocation?.trim()),
  ].filter(Boolean).length;
  const completenessRatio = known / 6;
  const index = 100 * (0.50 * pricePercentile + 0.25 * revenuePercentile + 0.10 * employeesPercentile + 0.15 * completenessRatio);
  const companySize = (revenuePercentile * 0.25 + employeesPercentile * 0.10) / 0.35;
  return {
    index, tier: tierFor(index),
    components: {
      pricePercentile, revenuePercentile, employeesPercentile, completenessRatio,
      economicLabel: band(pricePercentile), companySizeLabel: band(companySize),
      completenessLabel: completenessRatio === 1 ? "completa" : completenessRatio >= 0.5 ? "parcial" : "limitada",
    },
  };
}

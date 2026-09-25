import type { Deal } from "../deals/deal";
import { isOpenDeal } from "../deals/deal";
import { currency } from "../../lib/format";
import type { PriorityResult, ScoringEngine, ScoreBasis, SystemSignal } from "./scoring-engine";
import artifactData from "./model-artifact.json" with { type: "json" };

interface ModelArtifact {
  asOfDate: string;
  maxAge: number;
  ageEdges: number[];
  ageLabels: string[];
  numericMedian: number[];
  numericMean: number[];
  numericScale: number[];
  categoricalImpute: string[];
  categoricalValues: string[][];
  coefficients: number[];
  intercept: number;
  fallback: Record<string, number>;
  reference: {
    coveredPriorityValue: number[];
    outOfCoveragePrice: number[];
    prospectingPrice: number[];
  };
}

const artifact: ModelArtifact = artifactData;
const asOfMs = Date.parse(`${artifact.asOfDate}T00:00:00Z`);
const asOfYear = Number(artifact.asOfDate.slice(0, 4));
const DAY_MS = 86_400_000;

export const scoringSnapshotDate = artifact.asOfDate;

function ageDays(engageDate: string | null): number | null {
  if (!engageDate) return null;
  const parsed = Date.parse(`${engageDate}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((asOfMs - parsed) / DAY_MS);
}

function ageBand(age: number): string {
  for (let index = 0; index < artifact.ageLabels.length; index += 1) {
    if (artifact.ageEdges[index] <= age && age < artifact.ageEdges[index + 1]) return artifact.ageLabels[index];
  }
  throw new Error(`Idade fora da cobertura: ${age}`);
}

function predictPropensity(deal: Deal, age: number): number {
  const numeric = [age, deal.revenue, deal.employees, deal.yearEstablished === null ? null : asOfYear - deal.yearEstablished];
  const categorical = [ageBand(age), deal.product, deal.sector, deal.subsidiaryOf ? "yes" : "no"];
  let logit = artifact.intercept;
  let offset = 0;

  numeric.forEach((value, index) => {
    const filled = value ?? artifact.numericMedian[index];
    logit += ((filled - artifact.numericMean[index]) / artifact.numericScale[index]) * artifact.coefficients[offset++];
  });
  categorical.forEach((value, index) => {
    const filled = value ?? artifact.categoricalImpute[index];
    for (const category of artifact.categoricalValues[index]) {
      if (filled === category) logit += artifact.coefficients[offset];
      offset += 1;
    }
  });
  return 1 / (1 + Math.exp(-logit));
}

function lowerBound(values: number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values: number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < 1e-10) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
}

function relativeScore(basis: ScoreBasis, value: number, mode: "snapshot" | "reference"): number {
  const values = basis === "PROSPECTING_VALUE" ? artifact.reference.prospectingPrice
    : basis === "OUT_OF_COVERAGE_VALUE" ? artifact.reference.outOfCoveragePrice
      : artifact.reference.coveredPriorityValue;
  if (!values.length) return 50;
  const tolerance = Math.max(Math.abs(value) * 1e-12, 1e-10);
  const less = lowerBound(values, value - tolerance);
  const equal = upperBound(values, value + tolerance) - less;
  const position = mode === "snapshot" ? less + (equal + 1) / 2 : less + equal / 2;
  return roundHalfEven((100 * position) / values.length);
}

function scoreOpenDeal(deal: Deal, mode: "snapshot" | "reference"): PriorityResult {
  const price = deal.salesPrice;
  if (deal.stage === "Prospecting") {
    return {
      priorityScore: relativeScore("PROSPECTING_VALUE", price, mode),
      scoreBasis: "PROSPECTING_VALUE", confidence: "LOW", action: "ACTION_QUALIFY_PROSPECTING",
      reason: `Produto de ${currency.format(price)}. Ainda sem entrada em negociação; esta posição reflete o valor relativo na fila de qualificação, sem probabilidade temporal.`,
      nextAction: "Qualificar necessidade, contato e prazo.",
      limitation: "Não há data de entrada em negociação nem estimativa de vitória em 30 dias.",
      systemSignals: ["PROSPECTING_NO_ENGAGE_DATE"],
    };
  }

  const age = ageDays(deal.engageDate);
  if (age === null || age < 0) throw new Error(`Data de entrada inválida para ${deal.id}`);
  if (age > artifact.maxAge) {
    return {
      priorityScore: relativeScore("OUT_OF_COVERAGE_VALUE", price, mode),
      scoreBasis: "OUT_OF_COVERAGE_VALUE", confidence: "LOW", action: "ACTION_LAST_CONTACT_BEFORE_FREEZE",
      reason: `Em negociação há ${age} dias, além dos ${artifact.maxAge} dias cobertos pelo histórico. Não há propensão confiável para este caso; o score usa o valor relativo do produto (${currency.format(price)}) na fila de revalidação.`,
      nextAction: "Fazer contato de revalidação antes de considerar congelamento.",
      limitation: "Fora da cobertura histórica; a oportunidade precisa ser revalidada.",
      systemSignals: ["OUT_OF_COVERAGE_AGE"], ageDays: age,
    };
  }

  const known = deal.accountKnown;
  const basis: ScoreBasis = known ? "MODEL_FULL" : "AGE_ONLY_FALLBACK";
  const propensity30d = known ? predictPropensity(deal, age) : artifact.fallback[ageBand(age)];
  const priorityValue = propensity30d * price;
  const signals: SystemSignal[] = known ? ["MODEL_FULL"] : ["ACCOUNT_MISSING", "AGE_ONLY_FALLBACK"];
  if (age >= 121) signals.push("LOW_SUPPORT_AGE_121_138");
  const percentage = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(propensity30d);
  return {
    priorityScore: relativeScore(basis, priorityValue, mode),
    scoreBasis: basis,
    confidence: known ? "MEDIUM" : "LOW",
    action: known ? "ACTION_WORK_NOW" : "ACTION_ENRICH_ACCOUNT",
    reason: `Em negociação há ${age} dias. Para oportunidades semelhantes, a estimativa histórica de vitória nos próximos 30 dias é ${percentage}. Com produto de ${currency.format(price)}, o valor ponderado é ${currency.format(priorityValue)}.`,
    nextAction: known ? "Priorizar contato comercial agora." : "Enriquecer a conta e validar os dados antes do contato.",
    limitation: known ? "Estimativa histórica moderada; não é garantia de fechamento." : "Estimativa baseada apenas na faixa de idade; a ausência da conta não reduz diretamente o score.",
    propensity30d, priorityValue, systemSignals: signals, ageDays: age,
  };
}

export const scoringEngine: ScoringEngine = {
  score(deal, mode = "snapshot") {
    return isOpenDeal(deal) ? scoreOpenDeal(deal, mode) : null;
  },
};

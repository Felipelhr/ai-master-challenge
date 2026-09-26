import type { PriorityResult } from "./scoring-engine";

// Presentation order only: there is no allocation of attention across queues.
export const PRIORITY_QUEUES = ["SELL", "REVALIDATE", "QUALIFY"] as const;
export type PriorityQueue = (typeof PRIORITY_QUEUES)[number];
export const QUEUE_LABELS: Record<PriorityQueue, string> = {
  SELL: "Venda ativa", REVALIDATE: "Revalidação", QUALIFY: "Qualificação",
};
export const QUEUE_DESCRIPTIONS: Record<PriorityQueue, string> = {
  SELL: "Estimativa temporal × preço. Score compara somente oportunidades desta fila; não é probabilidade.",
  REVALIDATE: "Sem estimativa temporal. Maior valor primeiro para orientar contato de revalidação; idade não determina perda.",
  QUALIFY: "Sem estimativa temporal. Maior valor primeiro para orientar qualificação de necessidade, contato e prazo.",
};
export function priorityQueue(score: PriorityResult | null | undefined): PriorityQueue | null {
  if (!score) return null;
  if (score.scoreBasis === "PROSPECTING_VALUE") return "QUALIFY";
  if (score.scoreBasis === "OUT_OF_COVERAGE_VALUE") return "REVALIDATE";
  return "SELL";
}
export function hasTemporalScore(score: PriorityResult | null | undefined): boolean {
  return priorityQueue(score) === "SELL";
}
export function priorityCaption(score: PriorityResult | null | undefined): string {
  const queue = priorityQueue(score);
  if (!queue || !score) return "Sem score atual";
  return queue === "SELL" ? `Score ${score.priorityScore} · Venda ativa` : `${QUEUE_LABELS[queue]} · por valor`;
}
export function priorityExplanation(score: PriorityResult | null | undefined): string {
  if (!score) return "—";
  return hasTemporalScore(score) ? score.reason : score.reason.replace("o score usa o valor relativo do produto", "a base econômica usa o preço do produto");
}

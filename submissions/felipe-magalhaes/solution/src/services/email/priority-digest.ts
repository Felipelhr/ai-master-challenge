import type { CrmSnapshot } from "@/services/crm/crm-service";
import { rankTopFive, type PriorityFilters } from "@/services/priorities/rank-top-five";
import { nextTasksByDeal } from "@/domain/tasks/next-task";
import { ACTION_LABELS, CONFIDENCE_LABELS } from "@/domain/scoring/labels";
import { hasTemporalScore, priorityExplanation, QUEUE_LABELS, QUEUE_DESCRIPTIONS } from "@/domain/scoring/priority-queue";
import { currency } from "@/lib/format";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const short = (value: string) => value.length > 150 ? `${value.slice(0, 147)}…` : value;

export function priorityDigest(snapshot: CrmSnapshot, scope: PriorityFilters) {
  const ranking = rankTopFive(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, scope);
  const tasks = nextTasksByDeal(snapshot.tasks);
  const queues = ranking.queues.map((group) => ({
    queue: group.queue, label: QUEUE_LABELS[group.queue], description: QUEUE_DESCRIPTIONS[group.queue], eligibleCount: group.eligibleCount,
    items: group.items.map((deal, index) => {
      const score = snapshot.scores[deal.id];
      return { queue: group.queue, rank: index + 1, id: deal.id, account: deal.account, product: deal.product,
        score: hasTemporalScore(score) ? score.priorityScore : null,
        tier: snapshot.tiers[deal.id]?.tier ?? "—", evidence: CONFIDENCE_LABELS[score.confidence],
        reason: short(priorityExplanation(score)),
        action: ACTION_LABELS[score.action], nextTask: tasks[deal.id]?.title ?? "Nenhuma tarefa pendente", value: deal.value, link: null };
    }),
  }));
  const subject = "Suas prioridades por fila · G4 Lead Scorer";
  const text = `Suas prioridades por fila
${ranking.eligibleCount} oportunidades no recorte
Filas independentes. Não existe ranking global; a alocação de tempo é uma decisão comercial.

${queues.map((group) => `${group.label} · ${group.eligibleCount} oportunidades
${group.description}

${group.items.map((item) => `#${item.rank} nesta fila · ${item.account} (${item.id})
${item.score === null ? "Ordenação por valor · sem estimativa temporal" : `Score ${item.score} em Venda ativa`} · Tier ${item.tier} · Evidência ${item.evidence} · ${currency.format(item.value)}
Por quê: ${item.reason}
Ação: ${item.action}
Próxima tarefa: ${item.nextTask}`).join("\n\n") || "Nenhuma oportunidade nesta fila para os filtros atuais."}`).join("\n\n")}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#101b2c;max-width:680px;margin:auto"><h1>G4 Lead Scorer</h1><h2>Suas prioridades por fila</h2><p>Filas independentes. Não existe ranking global; a alocação de tempo é uma decisão comercial.</p>${queues.map((group) => `<section><h2>${group.label} · ${group.eligibleCount} oportunidades</h2><p>${escapeHtml(group.description)}</p>${group.items.map((item) => `<article style="padding:16px 0;border-top:1px solid #e1e3e8"><b>#${item.rank} nesta fila · ${item.score === null ? "Por valor · sem estimativa temporal" : `Score ${item.score} em Venda ativa`}</b><h3>${escapeHtml(item.account)}</h3><p>${escapeHtml(item.id)} · ${escapeHtml(item.product)} · ${escapeHtml(currency.format(item.value))}</p><p>Tier ${escapeHtml(item.tier)} · Evidência ${escapeHtml(item.evidence)}</p><p><b>Por quê:</b> ${escapeHtml(item.reason)}</p><p><b>Ação:</b> ${escapeHtml(item.action)}</p><p><b>Próxima tarefa:</b> ${escapeHtml(item.nextTask)}</p></article>`).join("") || "<p>Nenhuma oportunidade nesta fila para os filtros atuais.</p>"}</section>`).join("")}</div>`;
  // Flattened only for delivery IDs/logging; every item retains its queue and local rank.
  return { subject, text, html, queues, items: queues.flatMap((group) => group.items), eligibleCount: ranking.eligibleCount };
}

import type { CrmSnapshot } from "@/services/crm/crm-service";
import { rankTopFive, type PriorityFilters } from "@/services/priorities/rank-top-five";
import { nextTasksByDeal } from "@/domain/tasks/next-task";
import { ACTION_LABELS, CONFIDENCE_LABELS } from "@/domain/scoring/labels";
import { currency } from "@/lib/format";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const short = (value: string) => value.length > 150 ? `${value.slice(0, 147)}…` : value;

export function priorityDigest(snapshot: CrmSnapshot, scope: PriorityFilters) {
  const ranking = rankTopFive(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, scope);
  const tasks = nextTasksByDeal(snapshot.tasks);
  const items = ranking.items.map((deal, index) => {
    const score = snapshot.scores[deal.id];
    return { rank: index + 1, id: deal.id, account: deal.account, product: deal.product, score: score.priorityScore,
      tier: snapshot.tiers[deal.id]?.tier ?? "—", evidence: CONFIDENCE_LABELS[score.confidence], reason: short(score.reason),
      action: ACTION_LABELS[score.action], nextTask: tasks[deal.id]?.title ?? "Nenhuma tarefa pendente", value: deal.value,
      link: null };
  });
  const subject = "Suas prioridades · ARENA";
  const text = `Suas prioridades\n${ranking.eligibleCount} oportunidades no recorte\n\n${items.map((item) => `#${item.rank} ${item.account} (${item.id})\nScore ${item.score} · Tier ${item.tier} · Evidência ${item.evidence} · ${currency.format(item.value)}\nPor quê: ${item.reason}\nAção: ${item.action}\nPróxima tarefa: ${item.nextTask}${item.link ? `\nAbrir: ${item.link}` : ""}`).join("\n\n") || "Nenhuma oportunidade aberta corresponde ao recorte."}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#101b2c;max-width:680px;margin:auto"><div style="background:#101b2c;color:white;padding:24px;border-radius:12px 12px 0 0"><b style="color:#e8b319">ARENA</b><h1 style="margin:10px 0 0">Suas prioridades</h1></div><div style="padding:24px;border:1px solid #e1e3e8"><p style="color:#68707e">${ranking.eligibleCount} oportunidades no recorte · Score é prioridade relativa, não probabilidade.</p>${items.map((item) => `<article style="padding:17px 0;border-top:1px solid #e1e3e8"><b style="color:#be8e0b">#${item.rank} · Score ${item.score}</b><h2 style="font-size:18px;margin:7px 0">${escapeHtml(item.account)}</h2><p style="color:#68707e">${escapeHtml(item.id)} · ${escapeHtml(item.product)} · ${escapeHtml(currency.format(item.value))}</p><p>Tier ${escapeHtml(item.tier)} · Evidência ${escapeHtml(item.evidence)}</p><p><b>Por quê:</b> ${escapeHtml(item.reason)}</p><p><b>Ação:</b> ${escapeHtml(item.action)}</p><p><b>Próxima tarefa:</b> ${escapeHtml(item.nextTask)}</p>${item.link ? `<a href="${escapeHtml(item.link)}">Abrir oportunidade</a>` : ""}</article>`).join("") || "<p>Nenhuma oportunidade aberta corresponde ao recorte.</p>"}</div></div>`;
  return { subject, text, html, items, eligibleCount: ranking.eligibleCount };
}

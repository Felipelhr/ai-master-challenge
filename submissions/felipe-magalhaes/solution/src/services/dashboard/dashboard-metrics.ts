import type { CrmSnapshot } from "@/services/crm/crm-service";
import { filterPriorityDeals, rankTopFive, type PriorityFilters } from "@/services/priorities/rank-top-five";
import { ACTION_LABELS, CONFIDENCE_LABELS } from "@/domain/scoring/labels";
import { hasTemporalScore } from "@/domain/scoring/priority-queue";
import { LEAD_TIERS } from "@/domain/tiering/lead-tier";

export const PRIORITIZED_SCORE_CUTOFF = 80;
export type DashboardPeriod = "all" | "month" | "previous";
type Bucket = { label: string; count: number; value: number };

function localDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function dashboardMetrics(snapshot: CrmSnapshot, filters: PriorityFilters, period: DashboardPeriod, now = new Date()) {
  const deals = filterPriorityDeals(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, filters);
  const dealIds = new Set(deals.map((deal) => deal.id));
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const workNow = deals.filter((deal) => snapshot.scores[deal.id].action === "ACTION_WORK_NOW");
  const premium = deals.filter((deal) => ["A+", "A"].includes(snapshot.tiers[deal.id]?.tier ?? ""));
  const temporal = deals.filter((deal) => hasTemporalScore(snapshot.scores[deal.id]));
  const prioritized = temporal.filter((deal) => snapshot.scores[deal.id].priorityScore >= PRIORITIZED_SCORE_CUTOFF);
  const aggregate = (items: typeof deals) => ({ count: items.length, value: items.reduce((sum, deal) => sum + deal.value, 0) });
  const bucket = (label: string, items: typeof deals): Bucket => ({ label, ...aggregate(items) });
  const stages = snapshot.stages.filter((stage) => stage.category === "OPEN" && (stage.active || deals.some((deal) => deal.stageId === stage.id)))
    .map((stage) => bucket(stage.name, deals.filter((deal) => deal.stageId === stage.id)));
  const actions = Object.entries(ACTION_LABELS).map(([code, label]) => bucket(label, deals.filter((deal) => snapshot.scores[deal.id].action === code)));
  const tiers = LEAD_TIERS.map((tier) => bucket(tier, deals.filter((deal) => snapshot.tiers[deal.id]?.tier === tier)));
  const evidence = Object.entries(CONFIDENCE_LABELS).map(([code, label]) => bucket(label, deals.filter((deal) => snapshot.scores[deal.id].confidence === code)));
  const tasks = snapshot.tasks.filter((task) => dealIds.has(task.dealId));
  const today = localDate(now);
  const month = today.slice(0, 7);
  const previous = new Date(`${month}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const selectedMonth = period === "previous" ? previous.toISOString().slice(0, 7) : month;
  return {
    open: { count: deals.length, value: totalValue },
    workNow: aggregate(workNow), premium: aggregate(premium), prioritized: aggregate(prioritized),
    temporal: aggregate(temporal),
    averageScore: temporal.length ? temporal.reduce((sum, deal) => sum + snapshot.scores[deal.id].priorityScore, 0) / temporal.length : null,
    stages, actions, tiers, evidence,
    tasks: {
      pending: tasks.filter((task) => task.status === "PENDING").length,
      overdue: tasks.filter((task) => task.status === "PENDING" && task.dueAt && task.dueAt.slice(0, 10) < today).length,
      completed: tasks.filter((task) => task.status === "COMPLETED" && (period === "all" || task.completedAt?.slice(0, 7) === selectedMonth)).length,
    },
    topFive: rankTopFive(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, filters),
  };
}

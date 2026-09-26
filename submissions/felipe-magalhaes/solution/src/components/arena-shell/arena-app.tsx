"use client";

import { useMemo, useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";
import { runCrmOperation } from "@/app/actions";
import { nextTasksByDeal } from "@/domain/tasks/next-task";
import { number } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DealsList } from "@/components/deals/deals-list";
import { DealWorkspace } from "@/components/deals/deal-workspace";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { NewDealForm } from "@/components/deals/new-deal-form";
import { StageManager } from "@/components/pipeline/stage-manager";
import { HowItWorks } from "./how-it-works";
import { CrmFilters } from "./crm-filters";
import { TopFivePanel } from "@/components/priority/top-five-panel";
import { emptyPriorityFilters, rankTopFive, matchesPriorityScope, type PriorityFilters } from "@/services/priorities/rank-top-five";
import { PRIORITY_QUEUES, QUEUE_LABELS, type PriorityQueue } from "@/domain/scoring/priority-queue";
import { Sidebar, type View } from "./sidebar";
import { ScoreOpportunity, type ProductOption } from "@/components/priority/score-opportunity";
import type { CrmOperation, CrmSnapshot } from "@/services/crm/crm-service";
import type { EmailSchedule } from "@/services/email/email-types";
import { EmailDigestPanel } from "@/components/email/email-digest-panel";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DEFAULT_FUNNEL_ID, displayStageId, finalizationStage } from "@/domain/pipeline/stage";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const VIEW_TITLES: Record<View, string> = {
  list: "Lista", kanban: "KanBan", priorities: "Prioridades", tasks: "Tarefas", charts: "Gráficos", score: "Pontuar Oportunidade", about: "Como funciona",
};

export function ArenaApp({ initialSnapshot, initialSchedules, emailAvailable }: { initialSnapshot: CrmSnapshot; initialSchedules: EmailSchedule[]; emailAvailable: boolean }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [compact, setCompact] = useState(false);
  const [view, setView] = useState<View>("list");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"OPEN" | "WON" | "LOST" | "ALL">("OPEN");
  const [filters, setFilters] = useState<PriorityFilters>(emptyPriorityFilters);
  const [showFilters, setShowFilters] = useState(false);
  const selectedFunnel = filters.funnelId || DEFAULT_FUNNEL_ID;
  const [showNew, setShowNew] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [tasksLimit, setTasksLimit] = useState(50);

  async function mutate(operation: CrmOperation) {
    setPending(true); setError("");
    try {
      const next = await runCrmOperation(operation);
      setSnapshot(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a alteração.");
      throw cause;
    } finally { setPending(false); }
  }

  const selectedDeal = snapshot.deals.find((deal) => deal.id === selectedDealId) ?? null;
  const nextTasks = useMemo(() => nextTasksByDeal(snapshot.tasks), [snapshot.tasks]);
  const dealById = useMemo(() => new Map(snapshot.deals.map((deal) => [deal.id, deal])), [snapshot.deals]);
  const pendingTasks = useMemo(() => snapshot.tasks.filter((task) => task.status === "PENDING"), [snapshot.tasks]);
  const topFive = useMemo(() => rankTopFive(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, filters), [snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags, filters]);
  const defaultTopFive = useMemo(() => rankTopFive(snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags), [snapshot.deals, snapshot.scores, snapshot.tiers, snapshot.dealTags]);
  const tagIdsByDeal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of snapshot.dealTags) {
      const set = map.get(link.dealId) ?? new Set<string>(); set.add(link.tagId); map.set(link.dealId, set);
    }
    return map;
  }, [snapshot.dealTags]);
  const filteredDeals = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return snapshot.deals.filter((deal) => {
      if (status !== "ALL" && deal.status !== status) return false;
      if (normalized && ![deal.id, deal.account, deal.agent, deal.product, deal.manager, deal.region].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized))) return false;
      if (filters.agent && deal.agent !== filters.agent) return false;
      if (filters.manager && deal.manager !== filters.manager) return false;
      if (filters.region && deal.region !== filters.region) return false;
      if (filters.product && deal.product !== filters.product) return false;
      if (filters.funnelId && deal.funnelId !== filters.funnelId) return false;
      if (filters.sector && deal.sector !== filters.sector) return false;
      if (filters.stageId && displayStageId(deal) !== filters.stageId) return false;
      const score = snapshot.scores[deal.id];
      if (!matchesPriorityScope(score, filters)) return false;
      if (filters.leadTier && snapshot.tiers[deal.id]?.tier !== filters.leadTier) return false;
      if (filters.confidence && score?.confidence !== filters.confidence) return false;
      if (filters.action && score?.action !== filters.action) return false;
      if (filters.tagId && !tagIdsByDeal.get(deal.id)?.has(filters.tagId)) return false;
      return true;
    });
  }, [snapshot.deals, snapshot.scores, snapshot.tiers, status, query, filters, tagIdsByDeal]);
  const kanbanStages = useMemo(() => [...snapshot.stages.filter((stage) => stage.funnelId === selectedFunnel && stage.active && stage.category === "OPEN"), finalizationStage(selectedFunnel)], [snapshot.stages, selectedFunnel]);
  const kanbanDeals = useMemo(() => {
    const visibleStages = new Set(kanbanStages.map((stage) => stage.id));
    return filteredDeals.filter((deal) => deal.funnelId === selectedFunnel && visibleStages.has(displayStageId(deal) ?? ""));
  }, [filteredDeals, kanbanStages, selectedFunnel]);
  const products = useMemo(() => Array.from(new Map(snapshot.deals.map((deal) => [deal.product, { name: deal.product, series: deal.series, price: deal.salesPrice } satisfies ProductOption])).values()).sort((a, b) => a.name.localeCompare(b.name)), [snapshot.deals]);
  const sectors = useMemo(() => Array.from(new Set(snapshot.deals.map((deal) => deal.sector).filter((sector): sector is string => Boolean(sector)))).sort(), [snapshot.deals]);

  return <div className="arena-app">
    <Sidebar compact={compact} onToggle={() => setCompact(!compact)} view={view} onViewChange={setView} />
    <main className="arena-main">
      <header className="main-toolbar">
        <div className="toolbar-heading"><h1>{VIEW_TITLES[view]}</h1>{(view === "list" || view === "kanban") && <span className="toolbar-count">{number.format(view === "kanban" ? kanbanDeals.length : filteredDeals.length)} negócios</span>}</div>
        {(view === "list" || view === "kanban") && <div className="toolbar-actions">
          <div className="search-box"><Search size={18} /><Input aria-label="Buscar oportunidades" placeholder="Buscar oportunidade, conta, vendedor..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>}</div>
          <label className="status-filter"><Filter size={17} /><span>Status:</span><select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="OPEN">Aberto</option><option value="WON">Ganho</option><option value="LOST">Perdido</option><option value="ALL">Todos</option></select></label>
          {view === "kanban" && <Button variant="outline" onClick={() => setShowStages(true)}>Funis</Button>}
          <label className="status-filter">Fila<select aria-label="Filtrar fila de trabalho" value={filters.queue ?? ""} onChange={(event) => setFilters({ ...filters, queue: event.target.value as PriorityQueue | "", minScore: "", maxScore: "" })}><option value="">Todas as filas</option>{PRIORITY_QUEUES.map((queue) => <option key={queue} value={queue}>{QUEUE_LABELS[queue]}</option>)}</select></label>
          <Button variant="outline" onClick={() => setShowFilters(true)}>Filtros{Object.values(filters).filter(Boolean).length ? ` (${Object.values(filters).filter(Boolean).length})` : ""}</Button>
          <Button className="arena-primary" onClick={() => setShowNew(true)}><Plus size={17} /> Nova oportunidade</Button>
        </div>}
      </header>
      {error && <div className="operation-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dispensar erro"><X size={15} /></button></div>}
      {(view === "list" || view === "kanban") ? <div className="view-content">
        <div className="view-intro"><div><h2>{view === "list" ? "Carteira de oportunidades" : "Pipeline de negócios"}</h2><p>{view === "list" ? "Priorize, acompanhe tarefas e abra a oportunidade para trabalhar no contexto." : "Acompanhe etapas, tarefas e inteligência do pipeline."}</p></div><span className="data-caption">Base histórica + operação local · {number.format(snapshot.deals.length)} oportunidades</span></div>
        {view === "list" ? <DealsList deals={filteredDeals} scores={snapshot.scores} tiers={snapshot.tiers} stages={snapshot.stages} nextTasks={nextTasks} onOpen={(deal) => setSelectedDealId(deal.id)} /> : <KanbanBoard deals={kanbanDeals} scores={snapshot.scores} tiers={snapshot.tiers} stages={kanbanStages} funnelId={selectedFunnel} nextTasks={nextTasks} pending={pending} mutate={mutate} onOpen={(deal) => setSelectedDealId(deal.id)} />}
      </div> : view === "priorities" ? <div className="priorities-page"><div className="priorities-intro"><h2>Em que devo trabalhar agora?</h2><p>Escolha o objetivo do trabalho: venda ativa, revalidação ou qualificação. Cada fila tem sua própria ordem; não existe Top 5 global. Lead Tier é auxiliar e não entra no ranking.</p></div><CrmFilters deals={snapshot.deals} stages={snapshot.stages} funnels={snapshot.funnels} tags={snapshot.tags} value={filters} onChange={setFilters} /><TopFivePanel ranking={topFive} scores={snapshot.scores} tiers={snapshot.tiers} nextTasks={nextTasks} onOpen={(deal) => setSelectedDealId(deal.id)} /><EmailDigestPanel scope={filters} initialSchedules={initialSchedules} available={emailAvailable} /></div> : view === "charts" ? <DashboardPage snapshot={snapshot} filters={filters} onFilters={setFilters} onNavigate={setView} onOpen={(deal) => setSelectedDealId(deal.id)} /> : view === "tasks" ? <div className="tasks-page"><TopFivePanel ranking={defaultTopFive} scores={snapshot.scores} tiers={snapshot.tiers} nextTasks={nextTasks} onOpen={(deal) => setSelectedDealId(deal.id)} compact onSeeAll={() => setView("priorities")} /><h2>Tarefas do G4 Lead Scorer</h2><p>As mesmas tarefas visíveis em cada oportunidade. {number.format(pendingTasks.length)} pendentes.</p>{pendingTasks.slice(0, tasksLimit).map((task) => <button key={task.id} className="global-task" onClick={() => setSelectedDealId(task.dealId)}><strong>{task.title}</strong><span>{dealById.get(task.dealId)?.account ?? task.dealId}</span><span>{task.dueAt ?? "Sem prazo"}</span></button>)}{tasksLimit < pendingTasks.length && <Button variant="outline" onClick={() => setTasksLimit(tasksLimit + 50)}>Carregar mais tarefas</Button>}</div> : view === "score" ? <ScoreOpportunity products={products} sectors={sectors} /> : <HowItWorks />}
    </main>
    <DealWorkspace deal={selectedDeal} score={selectedDeal ? snapshot.scores[selectedDeal.id] ?? null : null} tier={selectedDeal ? snapshot.tiers[selectedDeal.id] : null} stages={snapshot.stages} funnels={snapshot.funnels} tasks={snapshot.tasks.filter((task) => task.dealId === selectedDealId)} nextTask={selectedDealId ? nextTasks[selectedDealId] ?? null : null} tags={snapshot.tags} dealTags={snapshot.dealTags.filter((link) => link.dealId === selectedDealId)} notes={snapshot.notes.filter((note) => note.dealId === selectedDealId)} pending={pending} mutate={mutate} onClose={() => setSelectedDealId(null)} />
    <NewDealForm open={showNew} onClose={() => setShowNew(false)} products={products} sectors={sectors} funnels={snapshot.funnels} stages={snapshot.stages} deals={snapshot.deals} pending={pending} mutate={mutate} onCreated={(id) => { setStatus("OPEN"); setQuery(id); setView("list"); setSelectedDealId(id); setShowNew(false); }} />
    <Sheet open={showFilters} onOpenChange={setShowFilters}><SheetContent className="management-sheet"><SheetTitle>Filtros</SheetTitle><SheetDescription>Escolha o recorte comercial. Os filtros não alteram o Score ou o Tier.</SheetDescription><CrmFilters deals={snapshot.deals} stages={snapshot.stages} funnels={snapshot.funnels} tags={snapshot.tags} value={filters} onChange={setFilters} /><Button onClick={() => setShowFilters(false)}>Aplicar filtros</Button></SheetContent></Sheet>
    <Sheet open={showStages} onOpenChange={setShowStages}><SheetContent className="management-sheet"><SheetTitle>Funis</SheetTitle><SheetDescription>Selecione o funil e gerencie suas etapas sem alterar a disposição do Kanban.</SheetDescription><StageManager funnels={snapshot.funnels} stages={snapshot.stages} selectedFunnel={selectedFunnel} onSelect={(funnelId) => setFilters((current) => ({ ...current, funnelId, stageId: "" }))} pending={pending} mutate={mutate} /></SheetContent></Sheet>
  </div>;
}

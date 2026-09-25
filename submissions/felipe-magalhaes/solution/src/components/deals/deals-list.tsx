"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrmDeal } from "@/domain/deals/deal";
import type { PipelineStage } from "@/domain/pipeline/stage";
import { displayStageId, FINALIZATION_STAGE_ID } from "@/domain/pipeline/stage";
import type { Task } from "@/domain/tasks/task";
import { currency, number } from "@/lib/format";
import { ACTION_LABELS, CONFIDENCE_LABELS, EVIDENCE_HELP } from "@/domain/scoring/labels";
import type { ScoresByDeal } from "@/services/scoring/score-snapshot";
import type { TiersByDeal } from "@/services/tiering/tier-snapshot";
import { sortDealsByScore, sortOperationalDeals } from "@/services/crm/operational-order";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BLOCK_SIZE = 25;
export const DEFAULT_COLUMNS = ["account","score","tier","action","reason","task","agent","value","stage","product","evidence","id"] as const;
type Column = (typeof DEFAULT_COLUMNS)[number];
const LABELS: Record<Column,string> = { account:"Conta", score:"Score", tier:"Tier", action:"Ação Recomendada", reason:"Motivo de Prioridade", task:"Tarefa", agent:"Vendedor", value:"Valor", stage:"Etapa", product:"Produto", evidence:"Qualidade da Evidência", id:"Oportunidade" };
const STORAGE_KEY = "arena-list-columns-v1";
type Sort = { column: Column; direction: "asc" | "desc" } | null;

export function DealsList({ deals, scores, tiers, stages, nextTasks, onOpen }: { deals: CrmDeal[]; scores: ScoresByDeal; tiers: TiersByDeal; stages: PipelineStage[]; nextTasks: Record<string, Task>; onOpen: (deal: CrmDeal) => void }) {
  const [limit, setLimit] = useState(BLOCK_SIZE);
  const [columns, setColumns] = useState<Column[]>([...DEFAULT_COLUMNS]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sort, setSort] = useState<Sort>(null);
  const scroll = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null);
  const horizontalBar = useRef<HTMLDivElement>(null);
  const tableScroll = useRef<HTMLDivElement | null>(null);
  const [tableWidth, setTableWidth] = useState(2200);
  const stageNames = useMemo(() => new Map([...stages.map((stage): [string,string] => [stage.id, stage.name]), [FINALIZATION_STAGE_ID, "Finalização"] as [string,string]]), [stages]);
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { const saved = JSON.parse(raw) as string[]; if (saved.length === DEFAULT_COLUMNS.length && DEFAULT_COLUMNS.every((key) => saved.includes(key))) requestAnimationFrame(() => setColumns(saved as Column[])); } catch { /* Preferência inválida: usar padrão. */ }
  }, []);
  useEffect(() => {
    if (limit >= deals.length || !sentinel.current || !scroll.current) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setLimit((current) => Math.min(current + BLOCK_SIZE, deals.length)); }, { root: scroll.current, rootMargin: "200px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [deals.length, limit]);
  useEffect(() => {
    const container = scroll.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]');
    const table = container?.querySelector("table");
    if (!container || !table) return;
    tableScroll.current = container;
    const updateWidth = () => setTableWidth(table.scrollWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(table);
    const syncBar = () => { if (horizontalBar.current) horizontalBar.current.scrollLeft = container.scrollLeft; };
    container.addEventListener("scroll", syncBar);
    return () => { observer.disconnect(); container.removeEventListener("scroll", syncBar); tableScroll.current = null; };
  }, []);
  const ordered = useMemo(() => {
    const all = sortOperationalDeals(deals, scores);
    if (!sort) return all;
    if (sort.column === "score") return sortDealsByScore(all, scores, sort.direction);
    const field = (deal: CrmDeal): string | number => {
      const score = scores[deal.id];
      switch (sort.column) {
        case "account": return deal.account; case "score": return score?.priorityScore ?? -1; case "tier": return tiers[deal.id]?.tier ?? "";
        case "action": return score ? ACTION_LABELS[score.action] : ""; case "reason": return score?.reason ?? "";
        case "task": return nextTasks[deal.id]?.title ?? ""; case "agent": return deal.agent; case "value": return deal.value;
        case "stage": return stageNames.get(displayStageId(deal) ?? "") ?? ""; case "product": return deal.product;
        case "evidence": return score ? CONFIDENCE_LABELS[score.confidence] : ""; case "id": return deal.id;
      }
    };
    return all.sort((a,b) => { const x = field(a), y = field(b); const comparison = typeof x === "number" && typeof y === "number" ? x-y : String(x).localeCompare(String(y),"pt-BR"); return (sort.direction === "asc" ? comparison : -comparison) || a.id.localeCompare(b.id); });
  }, [deals,scores,tiers,nextTasks,stageNames,sort]);
  function move(index: number, step: -1 | 1) {
    const target = index + step; if (target < 0 || target >= columns.length) return;
    const updated = [...columns]; [updated[index],updated[target]] = [updated[target],updated[index]];
    setColumns(updated); localStorage.setItem(STORAGE_KEY,JSON.stringify(updated));
  }
  function restoreColumns() { setColumns([...DEFAULT_COLUMNS]); localStorage.removeItem(STORAGE_KEY); }
  function cell(column: Column, deal: CrmDeal) {
    const score = scores[deal.id];
    switch (column) {
      case "account": return <strong>{deal.account}</strong>;
      case "score": return score ? <span className="priority-score">{score.priorityScore}</span> : "—";
      case "tier": return <span className="tier-badge">{tiers[deal.id]?.tier ?? "—"}</span>;
      case "action": return score ? ACTION_LABELS[score.action] : "—";
      case "reason": return <span className="reason-cell" title={score?.reason}>{score?.reason ?? "—"}</span>;
      case "task": return nextTasks[deal.id]?.title ?? "—";
      case "agent": return deal.agent;
      case "value": return currency.format(deal.value);
      case "stage": return <span className="stage-badge">{stageNames.get(displayStageId(deal) ?? "") ?? "—"}</span>;
      case "product": return deal.product;
      case "evidence": return score ? CONFIDENCE_LABELS[score.confidence] : "—";
      case "id": return <span className="deal-link">{deal.id}</span>;
    }
  }
  return <div className="list-panel">
    <div className="list-tools"><span>{sort ? `${LABELS[sort.column]} ${sort.direction === "asc" ? "↑" : "↓"}` : "Ordenação padrão · Score ↓, Valor ↓"}</span><div><Button variant="ghost" onClick={() => setSort(null)}>Ordenação padrão</Button><Button variant="outline" onClick={() => setColumnsOpen(true)}>Colunas</Button></div></div>
    <div className="list-horizontal-label">Arraste para ver as demais colunas →</div>
    <div className="list-horizontal-bar" ref={horizontalBar} aria-label="Rolagem horizontal da lista" onScroll={(event) => { if (tableScroll.current) tableScroll.current.scrollLeft = event.currentTarget.scrollLeft; }}><div style={{ width: tableWidth }} /></div>
    <div className="list-scroll" ref={scroll}><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column} className={`list-col-${column}`} title={column === "evidence" ? EVIDENCE_HELP : undefined}><button className="list-sort-button" onClick={() => setSort((current) => ({ column, direction: current?.column === column && current.direction === "asc" ? "desc" : "asc" }))}>{LABELS[column]} {sort?.column === column ? sort.direction === "asc" ? "↑" : "↓" : ""}</button></TableHead>)}</TableRow></TableHeader><TableBody>{ordered.slice(0,limit).map((deal) => <TableRow key={deal.id} className="deal-row" onClick={() => onOpen(deal)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(deal); }} aria-label={`Abrir oportunidade ${deal.id}`}>{columns.map((column) => <TableCell key={column} className={`list-col-${column}`}>{cell(column,deal)}</TableCell>)}</TableRow>)}</TableBody></Table><div ref={sentinel} className="list-sentinel" aria-hidden="true" /></div>
    {deals.length === 0 && <div className="empty-list">Nenhuma oportunidade corresponde aos filtros.</div>}
    <div className="list-pagination"><span>{number.format(Math.min(limit,deals.length))} de {number.format(deals.length)} oportunidades</span>{limit < deals.length && <span>Carregando ao rolar…</span>}</div>
    <Sheet open={columnsOpen} onOpenChange={setColumnsOpen}><SheetContent className="column-sheet"><SheetTitle>Organizar colunas</SheetTitle><SheetDescription>Use as setas para mudar a ordem. A preferência fica neste navegador.</SheetDescription><div className="column-order-list">{columns.map((column,index) => <div key={column}><span>{index+1}. {LABELS[column]}</span><button aria-label={`Mover ${LABELS[column]} para a esquerda`} disabled={index===0} onClick={() => move(index,-1)}>↑</button><button aria-label={`Mover ${LABELS[column]} para a direita`} disabled={index===columns.length-1} onClick={() => move(index,1)}>↓</button></div>)}</div><Button variant="outline" onClick={restoreColumns}>Restaurar ordem padrão</Button></SheetContent></Sheet>
  </div>;
}

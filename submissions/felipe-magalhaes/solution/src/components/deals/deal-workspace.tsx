"use client";

import { priorityCaption } from "@/domain/scoring/priority-queue";
import { useState } from "react";
import { ClipboardList, Database, NotebookPen, Sparkles, Tags, X } from "lucide-react";
import { STATUS_LABELS, type CrmDeal, type DealStatus } from "@/domain/deals/deal";
import { displayStageId, FINALIZATION_STAGE_ID, type Funnel, type PipelineStage } from "@/domain/pipeline/stage";
import type { Task } from "@/domain/tasks/task";
import type { Tag, DealTag } from "@/domain/tags/tag";
import type { Note } from "@/domain/notes/note";
import { pipelineTime } from "@/domain/pipeline/pipeline-time";
import { ACTION_LABELS, CONFIDENCE_LABELS } from "@/domain/scoring/labels";
import { EVIDENCE_HELP } from "@/domain/scoring/labels";
import type { LeadTierResult } from "@/domain/tiering/lead-tier";
import { TasksPanel, NotesPanel, TagsPanel, type Mutate } from "./operations-panels";
import { currency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { IntelligencePanel } from "@/components/priority/intelligence-panel";
import type { PriorityResult } from "@/domain/scoring/scoring-engine";

type Module = "tasks" | "notes" | "intelligence" | "tags" | "data";

const modules = [
  { id: "tasks", label: "Tarefas", icon: ClipboardList },
  { id: "notes", label: "Anotações", icon: NotebookPen },
  { id: "intelligence", label: "Inteligência", icon: Sparkles },
  { id: "tags", label: "Etiquetas", icon: Tags },
  { id: "data", label: "Dados", icon: Database },
] as const;

interface DealWorkspaceProps {
  deal: CrmDeal | null;
  score: PriorityResult | null;
  tier: LeadTierResult | null;
  stages: PipelineStage[];
  funnels: Funnel[];
  tasks: Task[];
  nextTask: Task | null;
  tags: Tag[];
  dealTags: DealTag[];
  notes: Note[];
  pending: boolean;
  mutate: Mutate;
  onClose: () => void;
}

export function DealWorkspace({ deal, score, tier, stages, funnels, tasks, nextTask, tags, dealTags, notes, pending, mutate, onClose }: DealWorkspaceProps) {
  const [module, setModule] = useState<Module>("tasks");
  const [engageDate, setEngageDate] = useState("");
  const stageName = deal && displayStageId(deal) === FINALIZATION_STAGE_ID ? "Finalização" : stages.find((stage) => stage.id === deal?.stageId)?.name ?? "—";
  const funnelName = funnels.find((funnel) => funnel.id === deal?.funnelId)?.name ?? "—";

  return (
    <Sheet open={Boolean(deal)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {deal && (
        <SheetContent className="workspace-sheet" showCloseButton={false}>
          <SheetTitle className="sr-only">Oportunidade {deal.id}</SheetTitle>
          <SheetDescription className="sr-only">Detalhes da oportunidade, módulos e dados contextuais.</SheetDescription>
          <div className="workspace-main">
            <header className="workspace-header">
              <div className="workspace-title-line">
                <div><span className="workspace-eyebrow">NEGÓCIO · {deal.id}</span><h2>{deal.account}</h2></div>
              </div>
              <div className="workspace-tabs" role="tablist" aria-label="Módulos da oportunidade">
                {modules.map(({ id, label }) => (
                  <button key={id} role="tab" aria-selected={module === id} onClick={() => setModule(id)} className={module === id ? "is-active" : ""}>{label}</button>
                ))}
              </div>
            </header>
            <div className="workspace-body">
              {module === "intelligence" && <IntelligencePanel result={score} tier={tier} />}
              {module === "tasks" && <TasksPanel dealId={deal.id} tasks={tasks} pending={pending} mutate={mutate} />}
              {module === "notes" && <NotesPanel dealId={deal.id} notes={notes} pending={pending} mutate={mutate} />}
              {module === "tags" && <TagsPanel dealId={deal.id} tags={tags} dealTags={dealTags} pending={pending} mutate={mutate} />}
              {module === "data" && <DataPanel deal={deal} />}
            </div>
          </div>
          <div className="workspace-rail" aria-label="Módulos">
            {modules.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setModule(id)} title={label} aria-label={label} className={module === id ? "is-active" : ""}><Icon size={20} /></button>)}
          </div>
          <aside className="workspace-context">
            <div className="context-heading"><strong>Oportunidade</strong><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar oportunidade"><X size={18} /></Button></div>
            <div className="context-card">
              <div className="context-card-title"><strong>Dados essenciais</strong></div>
              <dl>
                <dt>Conta</dt><dd>{deal.account}</dd>
                <dt>Oportunidade</dt><dd>{deal.id}</dd>
                <dt>Status</dt><dd><select aria-label="Status do negócio" value={deal.status} disabled={pending} onChange={(event) => { void mutate({ kind: "deal.status", dealId: deal.id, status: event.target.value as DealStatus }).catch(() => undefined); }}>{Object.entries(STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></dd>
                <dt>Funil</dt><dd>{funnelName}</dd>
                <dt>Etapa</dt><dd>{stageName}</dd>
                <dt>Vendedor</dt><dd>{deal.agent}</dd>
                <dt>Produto</dt><dd>{deal.product}</dd>
                <dt>Valor</dt><dd>{currency.format(deal.value)}</dd>
                <dt>Prioridade na fila</dt><dd>{priorityCaption(score)}</dd>
                <dt>Lead Tier</dt><dd>{tier?.tier ?? "—"}</dd>
                <dt title={EVIDENCE_HELP}>Qualidade da Evidência</dt><dd>{score ? CONFIDENCE_LABELS[score.confidence] : "—"}</dd>
                <dt>Ação Recomendada</dt><dd>{score ? ACTION_LABELS[score.action] : "—"}</dd>
                <dt>Próxima tarefa</dt><dd>{nextTask?.title ?? "Nenhuma"}</dd>
                <dt>Tempo no pipeline</dt><dd>{pipelineTime(deal)}</dd>
              </dl>
              <div className="stage-change"><label>Alterar etapa<select aria-label="Alterar etapa" value={deal.stageId ?? ""} disabled={pending} onChange={(event) => { if (event.target.value) void mutate({ kind: "deal.stage", dealId: deal.id, stageId: event.target.value, engageDate: engageDate || deal.engageDate }).catch(() => undefined); }}><option value="">—</option>{stages.filter((stage) => stage.active && stage.category === "OPEN").map((stage) => <option key={stage.id} value={stage.id}>{funnels.find((funnel) => funnel.id === stage.funnelId)?.name} · {stage.name}</option>)}</select></label><label>Entrada em negociação<input type="date" value={engageDate || deal.engageDate || ""} onChange={(event) => setEngageDate(event.target.value)} /></label><small>Ao entrar em negociação, informe a data antes de mudar a etapa.</small></div>
            </div>
          </aside>
        </SheetContent>
      )}
    </Sheet>
  );
}

function DataPanel({ deal }: { deal: CrmDeal }) {
  return <section className="workspace-section"><h3>Dados da oportunidade</h3><div className="summary-grid">
    <div><span>ID</span><strong>{deal.id}</strong></div><div><span>Série</span><strong>{deal.series}</strong></div>
    <div><span>Conta no cadastro</span><strong>{deal.accountKnown ? "Sim" : "Não"}</strong></div><div><span>Fechamento</span><strong>{formatDate(deal.closeDate)}</strong></div>
  </div></section>;
}

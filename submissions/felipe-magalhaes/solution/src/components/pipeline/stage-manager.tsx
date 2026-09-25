"use client";

import { useState } from "react";
import type { Funnel, PipelineStage } from "@/domain/pipeline/stage";
import { Button } from "@/components/ui/button";
import type { Mutate } from "@/components/deals/operations-panels";

export function StageManager({ funnels, stages, selectedFunnel, onSelect, pending, mutate }: { funnels: Funnel[]; stages: PipelineStage[]; selectedFunnel: string; onSelect: (id: string) => void; pending: boolean; mutate: Mutate }) {
  const [newFunnel, setNewFunnel] = useState(""); const [newStage, setNewStage] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [draft, setDraft] = useState("");
  const run = (operation: Parameters<Mutate>[0]) => { void mutate(operation).catch(() => undefined); };
  const active = stages.filter((stage) => stage.active && stage.category === "OPEN" && stage.funnelId === selectedFunnel);
  const funnel = funnels.find((item) => item.id === selectedFunnel);
  return <div className="funnel-manager">
    <label>Funil atual<select value={selectedFunnel} onChange={(event) => onSelect(event.target.value)}>{funnels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="funnel-list"><h3>Funis existentes</h3>{funnels.map((item) => <button key={item.id} className={item.id === selectedFunnel ? "is-active" : ""} onClick={() => onSelect(item.id)}>{item.name}</button>)}</div>
    {funnel && <div className="funnel-rename"><label>Nome do funil<input value={editing === funnel.id ? draft : funnel.name} onChange={(event) => { setEditing(funnel.id); setDraft(event.target.value); }} /></label><Button variant="outline" disabled={pending || editing !== funnel.id || !draft.trim()} onClick={() => { run({ kind: "funnel.update", id: funnel.id, name: draft }); setEditing(null); }}>Renomear</Button></div>}
    <div className="funnel-create"><input aria-label="Nome do novo funil" placeholder="Nome do novo funil" value={newFunnel} onChange={(event) => setNewFunnel(event.target.value)} /><Button disabled={pending || !newFunnel.trim()} onClick={() => { run({ kind: "funnel.create", name: newFunnel }); setNewFunnel(""); }}>Criar funil</Button></div>
    <h3>Etapas deste funil</h3><div className="stage-list">{active.map((stage,index) => <StageRow key={stage.id} stage={stage} index={index} length={active.length} pending={pending} run={run} />)}<div className="stage-manager-row"><strong>Finalização</strong><span>Etapa fixa · ganhos e perdidos</span></div></div>
    <div className="stage-create"><input aria-label="Nome da nova etapa" placeholder="Nome da nova etapa" value={newStage} onChange={(event) => setNewStage(event.target.value)} /><Button disabled={pending || !newStage.trim()} onClick={() => { run({ kind: "stage.create", funnelId: selectedFunnel, name: newStage }); setNewStage(""); }}>Adicionar etapa</Button></div>
    <p>Etapas com negócios precisam ser esvaziadas antes da exclusão.</p>
  </div>;
}

function StageRow({ stage, index, length, pending, run }: { stage: PipelineStage; index: number; length: number; pending: boolean; run: (operation: Parameters<Mutate>[0]) => void }) {
  const [editing, setEditing] = useState(false); const [name, setName] = useState(stage.name);
  return <div className="stage-manager-row">{editing ? <><input aria-label="Novo nome da etapa" value={name} onChange={(event) => setName(event.target.value)} /><button disabled={pending || !name.trim()} onClick={() => { run({ kind: "stage.update", id: stage.id, name }); setEditing(false); }}>Salvar</button></> : <strong>{stage.name}</strong>}<button onClick={() => setEditing(true)}>Editar</button><button disabled={index===0 || pending} onClick={() => run({ kind: "stage.move", id: stage.id, direction: -1 })} aria-label={`Mover ${stage.name} para cima`}>↑</button><button disabled={index===length-1 || pending} onClick={() => run({ kind: "stage.move", id: stage.id, direction: 1 })} aria-label={`Mover ${stage.name} para baixo`}>↓</button>{!stage.isDefault && <button disabled={pending} onClick={() => run({ kind: "stage.delete", id: stage.id })}>Remover</button>}</div>;
}

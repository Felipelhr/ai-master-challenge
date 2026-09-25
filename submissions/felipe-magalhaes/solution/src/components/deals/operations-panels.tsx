"use client";

import { useState } from "react";
import type { Task } from "@/domain/tasks/task";
import type { Note } from "@/domain/notes/note";
import type { Tag, DealTag } from "@/domain/tags/tag";
import type { CrmOperation, CrmSnapshot } from "@/services/crm/crm-service";
import { Button } from "@/components/ui/button";

export type Mutate = (operation: CrmOperation) => Promise<CrmSnapshot>;
const run = (mutate: Mutate, operation: CrmOperation) => { void mutate(operation).catch(() => undefined); };

export function TasksPanel({ dealId, tasks, pending, mutate }: { dealId: string; tasks: Task[]; pending: boolean; mutate: Mutate }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [dueAt, setDueAt] = useState("");
  function reset() { setTitle(""); setDescription(""); setDueAt(""); setEditing(null); setCreating(false); }
  function submit() {
    const operation: CrmOperation = editing ? { kind: "task.update", id: editing, title, description, dueAt: dueAt || null } : { kind: "task.create", dealId, title, description, dueAt: dueAt || null };
    void mutate(operation).then(reset).catch(() => undefined);
  }
  return <section className="workspace-section"><h3>Tarefas</h3><p className="section-lead">Ações futuras da oportunidade.</p>
    <div className="operation-timeline">{tasks.length === 0 && <p>Nenhuma tarefa cadastrada.</p>}{tasks.slice().sort((a, b) => Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED") || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")).map((task) => <article key={task.id} className={`operation-card ${task.status === "COMPLETED" ? "is-completed" : ""}`}>
      <div className="operation-card-head"><label><input type="checkbox" checked={task.status === "COMPLETED"} disabled={pending} onChange={() => run(mutate, { kind: "task.status", id: task.id, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" })} /><strong>{task.title}</strong></label><span>{task.status === "PENDING" ? "Pendente" : "Concluída"}</span></div>
      {task.description && <p>{task.description}</p>}<div className="operation-card-foot"><span>{task.dueAt ? `Vence em ${task.dueAt}` : "Sem vencimento"}</span>{task.source === "SYSTEM_ACTION" && <span>Origem: inteligência</span>}<button onClick={() => { setEditing(task.id); setCreating(true); setTitle(task.title); setDescription(task.description ?? ""); setDueAt(task.dueAt ?? ""); }}>Editar</button><button onClick={() => run(mutate, { kind: "task.delete", id: task.id })}>Excluir</button></div>
    </article>)}</div>
    {creating ? <div className="compact-form"><h4>{editing ? "Editar tarefa" : "Nova tarefa"}</h4><input aria-label="Título da tarefa" placeholder="Título" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea aria-label="Descrição da tarefa" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} /><label>Vencimento <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><div><Button onClick={submit} disabled={pending || !title.trim()}>Salvar</Button><Button variant="ghost" onClick={reset}>Cancelar</Button></div></div> : <Button variant="outline" onClick={() => { reset(); setCreating(true); }}>+ Nova tarefa</Button>}
  </section>;
}

export function NotesPanel({ dealId, notes, pending, mutate }: { dealId: string; notes: Note[]; pending: boolean; mutate: Mutate }) {
  const [editing, setEditing] = useState<string | null>(null); const [content, setContent] = useState(""); const [creating, setCreating] = useState(false);
  function reset() { setEditing(null); setContent(""); setCreating(false); }
  function submit() { const operation: CrmOperation = editing ? { kind: "note.update", id: editing, content } : { kind: "note.create", dealId, content }; void mutate(operation).then(reset).catch(() => undefined); }
  return <section className="workspace-section"><h3>Anotações</h3><p className="section-lead">Contexto e histórico registrado no negócio.</p>
    <div className="operation-timeline">{notes.length === 0 && <p>Nenhuma anotação cadastrada.</p>}{notes.map((note) => <article key={note.id} className="operation-card"><p>{note.content}</p><div className="operation-card-foot"><span>{new Date(note.updatedAt).toLocaleString("pt-BR")}</span><button onClick={() => { setEditing(note.id); setContent(note.content); setCreating(true); }}>Editar</button><button onClick={() => run(mutate, { kind: "note.delete", id: note.id })}>Excluir</button></div></article>)}</div>
    {creating ? <div className="compact-form"><textarea aria-label="Conteúdo da anotação" placeholder="Escreva uma anotação" value={content} onChange={(event) => setContent(event.target.value)} /><div><Button onClick={submit} disabled={pending || !content.trim()}>Salvar</Button><Button variant="ghost" onClick={reset}>Cancelar</Button></div></div> : <Button variant="outline" onClick={() => setCreating(true)}>+ Nova anotação</Button>}
  </section>;
}

export function TagsPanel({ dealId, tags, dealTags, pending, mutate }: { dealId: string; tags: Tag[]; dealTags: DealTag[]; pending: boolean; mutate: Mutate }) {
  const [name, setName] = useState(""); const [color, setColor] = useState("#5b83c5"); const [editing, setEditing] = useState<string | null>(null);
  const linked = new Set(dealTags.map((item) => item.tagId));
  const system = tags.filter((tag) => tag.type === "SYSTEM" && linked.has(tag.id));
  const user = tags.filter((tag) => tag.type === "USER");
  function submit() { const op: CrmOperation = editing ? { kind: "tag.update", id: editing, name, color } : { kind: "tag.create", dealId, name, color }; void mutate(op).then(() => { setName(""); setEditing(null); }).catch(() => undefined); }
  return <section className="workspace-section"><h3>Etiquetas</h3><p className="section-lead">Sinais da inteligência e etiquetas adicionadas pela equipe.</p>
    <h4 className="tag-group-heading">Tags do sistema</h4><div className="tag-chips">{system.length === 0 && <span className="muted-small">Nenhum sinal atual.</span>}{system.map((tag) => <span key={tag.id} className="tag-chip" style={{ borderColor: tag.color, color: tag.color }}>{tag.name}</span>)}</div>
    <h4 className="tag-group-heading">Tags do usuário</h4><div className="tag-chips">{user.filter((tag) => linked.has(tag.id)).map((tag) => <span key={tag.id} className="tag-chip" style={{ borderColor: tag.color, color: tag.color }}>{tag.name}<button aria-label={`Remover ${tag.name}`} onClick={() => run(mutate, { kind: "tag.detach", dealId, tagId: tag.id })}>×</button><button aria-label={`Editar ${tag.name}`} onClick={() => { setEditing(tag.id); setName(tag.name); setColor(tag.color); }}>✎</button></span>)}</div>
    <div className="compact-form"><label>Adicionar etiqueta existente<select aria-label="Adicionar etiqueta existente" defaultValue="" onChange={(event) => { if (event.target.value) run(mutate, { kind: "tag.attach", dealId, tagId: event.target.value }); event.target.value = ""; }}><option value="">Selecione</option>{user.filter((tag) => !linked.has(tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><h4>{editing ? "Editar etiqueta" : "Criar etiqueta"}</h4><div className="tag-edit-line"><input aria-label="Nome da etiqueta" placeholder="Nome da etiqueta" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="Cor da etiqueta" type="color" value={color} onChange={(event) => setColor(event.target.value)} /><Button onClick={submit} disabled={pending || !name.trim()}>Salvar</Button></div>{editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(""); }}>Cancelar edição</Button>}</div>
  </section>;
}

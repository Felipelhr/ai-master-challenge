"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Columns3,
  List,
  Menu,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type View = "list" | "kanban" | "priorities" | "tasks" | "charts" | "score" | "about";

const navigation = [
  { id: "list", label: "Lista", icon: List },
  { id: "kanban", label: "KanBan", icon: Columns3 },
  { id: "priorities", label: "Prioridades", icon: Sparkles },
  { id: "tasks", label: "Tarefas", icon: ClipboardList },
  { id: "charts", label: "Gráficos", icon: ChartNoAxesCombined },
  { id: "score", label: "Pontuar Oportunidade", icon: Target },
  { id: "about", label: "Como funciona", icon: CircleHelp },
] as const;

interface SidebarProps {
  compact: boolean;
  onToggle: () => void;
  view: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ compact, onToggle, view, onViewChange }: SidebarProps) {
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const environmentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!environmentOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!environmentRef.current?.contains(event.target as Node)) setEnvironmentOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setEnvironmentOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [environmentOpen]);
  return (
    <aside className={`arena-sidebar ${compact ? "is-compact" : ""}`}>
      <div className="sidebar-brand">
        {!compact && <strong>G4 Lead Scorer</strong>}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label={compact ? "Expandir menu" : "Recolher menu"} title={compact ? "Expandir menu" : "Recolher menu"}>
          <Menu size={22} />
        </Button>
      </div>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-link ${view === id ? "is-active" : ""}`}
            onClick={() => { setEnvironmentOpen(false); onViewChange(id); }}
            title={compact ? label : undefined}
            aria-label={label}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={21} strokeWidth={1.9} />
            {!compact && <span>{label}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-environment" ref={environmentRef}>
        {environmentOpen && <div className="environment-menu" role="menu" aria-label="Ambientes de trabalho">
          <button type="button" role="menuitem" onClick={() => setEnvironmentOpen(false)}><Check size={16} /><span>Felipe Magalhães<small>Ambiente local</small></span></button>
          <div className="environment-future" aria-disabled="true"><span>Adicionar outra empresa ou ambiente de trabalho para gestão</span><small>Em breve</small></div>
        </div>}
        <button type="button" className="sidebar-footer" onClick={() => setEnvironmentOpen((open) => !open)} aria-label="Selecionar ambiente de trabalho" aria-haspopup="menu" aria-expanded={environmentOpen}>
          <span className="profile-avatar">FM</span>
          {!compact && <span className="profile-copy"><span>Ambiente local</span><strong>Felipe Magalhães</strong></span>}
          {!compact && <ChevronDown size={16} />}
        </button>
      </div>
    </aside>
  );
}

"""Compact CRM board and isolated opportunity detail."""
from __future__ import annotations

from datetime import date
from html import escape
import re
import re

import pandas as pd
import streamlit as st

import crm_state as state
from labels import label, labels
from ui import kanban_order

def _date(value):
    return date.fromisoformat(str(value)) if pd.notna(value) and value else None


def _refresh():
    st.rerun(scope="fragment")


def _explanation(value):
    """Render model explanations as ordinary PT-BR prose without code styling."""
    text = str(value).replace("`", "")
    return re.sub(r"(?<=\d)\.(?=\d+%)", ",", text)


def _task_controls(task, primary=False):
    task_id = task["task_id"]
    status = label(task["status"])
    due_date = task["due_date"] if pd.notna(task["due_date"]) else None
    with st.expander(f"{'○' if task['status'] == 'PENDING' else '✓'} {task['title']}", expanded=primary):
        st.write(task["description"] or "Sem descrição")
        st.caption(f"Vencimento: {due_date or 'Sem data'} · Status: {status}")
        st.caption("Origem: Ação recomendada do sistema" if task["source"] == "SYSTEM_ACTION" else "Origem: Usuário")
        edit_key = f"edit_task_open_{task_id}"
        if st.session_state.get(edit_key):
            with st.form(f"edit_task_{task_id}"):
                title = st.text_input("Título", value=task["title"])
                description = st.text_area("Descrição", value=task["description"] or "")
                has_due = st.checkbox("Com vencimento", value=bool(due_date))
                due = st.date_input("Vencimento", value=_date(due_date) or date.today())
                save = st.form_submit_button("Salvar tarefa")
            if save:
                state.update_task(task_id, title, description, due if has_due else None)
                st.session_state[edit_key] = False
                _refresh()
        else:
            st.button("Editar", key=f"edit_{task_id}", on_click=lambda: st.session_state.__setitem__(edit_key, True))
        a, b = st.columns(2)
        a.button("Concluir" if task["status"] == "PENDING" else "Reabrir", key=f"status_{task_id}", on_click=state.set_task_status, args=(task_id, "COMPLETED" if task["status"] == "PENDING" else "PENDING"))
        b.button("Excluir tarefa", key=f"delete_{task_id}", on_click=state.delete_task, args=(task_id,))


@st.dialog("Detalhes da oportunidade", width="large")
def opportunity_dialog(row, custom_stages=None):
    custom_stages = custom_stages or []
    oid = row["opportunity_id"]
    tasks = state.list_tasks()
    tags = state.list_tags()
    notes = state.list_notes()
    user_tags = tags.loc[tags["opportunity_id"] == oid, "tag"].tolist()
    deal_tasks = tasks[tasks["opportunity_id"] == oid]
    deal_notes = notes[notes["opportunity_id"] == oid]

    main, side = st.columns([7, 3], gap="large")
    with side:
        st.subheader("Resumo")
        st.write(f"**Conta:** {row['account'] if pd.notna(row['account']) else 'Conta não identificada'}")
        st.write(f"**Oportunidade:** {oid}")
        st.write(f"**Etapa:** {label(row['deal_stage'])}")
        st.write(f"**Produto:** {row['product']}")
        st.write(f"**Valor:** US$ {row['sales_price']:,.0f}")
        st.write(f"**Vendedor:** {row['sales_agent']}")
        st.write(f"**Manager:** {row['manager']}")
        st.write(f"**Regional:** {row['regional_office']}")
        if pd.notna(row.get("age_days")):
            st.write(f"**Tempo no pipeline:** {int(row['age_days'])} dias")
        if custom_stages:
            stage_names = {item["stage_id"]: item["name"] for item in custom_stages}
            current = row.get("pipeline_stage") if row.get("pipeline_stage") in stage_names else None
            chosen = st.selectbox(
                "Etapa personalizada", [None] + list(stage_names),
                index=([None] + list(stage_names)).index(current),
                format_func=lambda value: "Etapa padrão" if value is None else stage_names[value],
                key=f"pipeline_stage_choice_{oid}",
            )
            if st.button("Salvar etapa", key=f"pipeline_stage_save_{oid}"):
                state.set_opportunity_pipeline_stage(oid, chosen)
                _refresh()
        upcoming = state.next_task(tasks, oid)
        st.divider()
        st.write("**Próxima tarefa**")
        if upcoming is None:
            st.caption("Nenhuma tarefa pendente")
        else:
            st.write(upcoming["title"])
            st.caption(upcoming["description"] or "Sem descrição")
            st.caption(f"Vencimento: {upcoming['due_date'] or 'sem data'} · {label(upcoming['status'])}")
    with main:
        st.subheader(f"{row['account'] if pd.notna(row['account']) else 'Conta não identificada'} · {oid}")
        area = st.segmented_control("Área", ["Tarefas", "Observações", "Score", "Tags", "Dados"], default="Tarefas", key=f"detail_area_{oid}")
    with main if area == "Score" else st.container():
      if area == "Score":
        a, b, c = st.columns(3)
        a.metric("Score de Prioridade", f"{int(row['Priority Score'])}/100" if pd.notna(row["Priority Score"]) else "—")
        b.metric("Confiança", label(row["Confidence"]))
        with c:
            st.caption("Base do Score")
            st.markdown(f"<div class='score-basis-value'>{escape(label(row['Score Basis']))}</div>", unsafe_allow_html=True)
        st.write(f"**Ação Recomendada:** {label(row['Action Tag'])}")
        if pd.notna(row.get("propensity_30d")):
            st.write(f"**Propensão em 30 dias:** {row['propensity_30d']:.1%}")
        if pd.notna(row.get("reason")):
            st.write("**Por quê:** " + _explanation(row["reason"]))
            st.write("**Próxima ação:** " + _explanation(row["next_action"]))
            st.write("**Limitação:** " + _explanation(row["limitation"]))
        else:
            st.caption("Oportunidade encerrada; não recebe score operacional.")

    with main if area == "Tags" else st.container():
      if area == "Tags":
        st.write("**Tags do sistema (protegidas):** " + (", ".join(labels(row["System Tags"])) or "—"))
        st.write("**Suas tags:** " + (", ".join(user_tags) or "—"))
        with st.form(f"add_tag_{oid}"):
            new_tag = st.text_input("Nova tag")
            if st.form_submit_button("Adicionar tag"):
                state.add_tag(oid, new_tag)
                _refresh()
        if user_tags:
            selected = st.selectbox("Tag para editar", user_tags, key=f"tag_sel_{oid}")
            renamed = st.text_input("Novo nome", value=selected, key=f"tag_rename_{oid}")
            a, b = st.columns(2)
            if a.button("Salvar nome", key=f"tag_save_{oid}"):
                state.rename_tag(oid, selected, renamed)
                _refresh()
            if b.button("Remover tag", key=f"tag_remove_{oid}"):
                state.remove_tag(oid, selected)
                _refresh()

    with main if area == "Tarefas" else st.container():
      if area == "Tarefas":
        pending = deal_tasks[deal_tasks["status"] == "PENDING"]
        completed = deal_tasks[deal_tasks["status"] == "COMPLETED"]
        st.write(f"**Pendentes:** {len(pending)} · **Concluídas:** {len(completed)}")
        ordered = pd.concat([pending, completed]).sort_values(["status", "due_date", "created_at"], ascending=[False, True, True], na_position="last")
        upcoming = state.next_task(deal_tasks, oid)
        primary_id = upcoming["task_id"] if upcoming is not None else None
        for _, task in ordered.iterrows():
            _task_controls(task, primary=task["task_id"] == primary_id)
        new_key = f"new_task_open_{oid}"
        new_slot = st.empty()
        with new_slot.container():
            if not st.session_state.get(new_key):
                st.button("+ Nova tarefa", key=f"new_task_toggle_{oid}", on_click=lambda: st.session_state.__setitem__(new_key, True))
            else:
                with st.form(f"new_task_{oid}"):
                    title = st.text_input("Título da tarefa")
                    description = st.text_area("Descrição opcional")
                    has_due = st.checkbox("Definir vencimento")
                    due = st.date_input("Data de vencimento", value=date.today())
                    if st.form_submit_button("Criar tarefa"):
                        state.create_task(oid, title, description, due if has_due else None)
                        st.session_state[new_key] = False
                        _refresh()
                st.button("Cancelar", key=f"new_task_cancel_{oid}", on_click=lambda: st.session_state.__setitem__(new_key, False))

    with main if area == "Observações" else st.container():
      if area == "Observações":
        with st.form(f"new_note_{oid}"):
            content = st.text_area("Nova observação")
            if st.form_submit_button("Salvar observação"):
                state.create_note(oid, content)
                _refresh()
        for _, note in deal_notes.iterrows():
            with st.expander(f"{note['created_at'][:16]} · {note['content'][:55]}"):
                with st.form(f"edit_note_{note['note_id']}"):
                    revised = st.text_area("Texto", value=note["content"])
                    if st.form_submit_button("Salvar edição"):
                        state.update_note(note["note_id"], revised)
                        _refresh()
                st.caption(f"Criada: {note['created_at']} · Atualizada: {note['updated_at']}")
                if st.button("Excluir observação", key=f"delete_note_{note['note_id']}"):
                    state.delete_note(note["note_id"])
                    _refresh()
    if area == "Dados":
        with main:
            st.json({str(k): str(v) for k, v in row.items()})


def _card(row, custom_stages=None):
    oid = row["opportunity_id"]
    with st.container(border=True):
        score = f"{int(row['Priority Score'])}" if pd.notna(row["Priority Score"]) else "—"
        account = row["account"] if pd.notna(row["account"]) else "Conta não identificada"
        price = f"{row['sales_price']:,.0f}".replace(",", ".")
        important = [x for x in row["System Tags"] if x in ("TOP_5_SELLER", "FOLLOWUP_AUTOMATIZADO", "ACCOUNT_MISSING", "OUT_OF_COVERAGE_AGE")]
        tag_text = " · ".join(labels(important)[:2] + row["User Tags"][:max(0, 2 - len(important[:2]))])
        next_task = f"<div class='crm-next'>📅 {escape(str(row['next_task']))} · {escape(str(row.get('next_task_description') or 'Sem descrição'))} · {escape(str(row['next_task_due'])) if pd.notna(row['next_task_due']) else 'sem data'} · Pendente</div>" if pd.notna(row["next_task"]) else ""
        age = f" · {int(row['age_days'])} dias no pipeline" if pd.notna(row["age_days"]) else ""
        basis = {"MODEL_FULL": "Modelo", "AGE_ONLY_FALLBACK": "Idade", "OUT_OF_COVERAGE_VALUE": "Revalidação", "PROSPECTING_VALUE": "Valor", "HISTORICAL": "Histórico"}.get(row["Score Basis"], label(row["Score Basis"]))
        st.markdown(
            f"<div class='crm-score'>{escape(score)}<span>/100</span></div>"
            f"<div class='crm-account'>{escape(str(account))}</div>"
            f"<div class='crm-product'>{escape(str(row['product']))} · US$ {price}</div>"
            f"<div class='crm-seller'>{escape(str(row['sales_agent']))}</div>"
            f"<div class='crm-action'>{escape(label(row['Action Tag']))}</div>"
            + (f"<div class='crm-tags'>{escape(tag_text)}</div>" if tag_text else "")
            + next_task
            + f"<div class='crm-footer'>{escape(label(row['Confidence']))}{age} · {escape(basis)}</div>",
            unsafe_allow_html=True,
        )
        if st.button(f"Abrir · {oid}", key=f"card_{oid}", width="stretch"):
            opportunity_dialog(row, custom_stages)


def kanban(frame, closed, custom_stages=None):
    custom_stages = custom_stages or []
    title, totals, status_col = st.columns([1.2, 1.3, 2], vertical_alignment="center")
    with title:
        st.subheader("Pipeline")
    with status_col:
        status_options = {"key": "pipeline_status", "label_visibility": "collapsed"}
        if "pipeline_status" not in st.session_state:
            status_options["default"] = "ABERTO"
        status = st.segmented_control("Status", ["ABERTO", "GANHO", "PERDIDO", "TODOS"], **status_options)
    custom_ids = [item["stage_id"] for item in custom_stages]
    stages = {"ABERTO": ["Prospecting", "Engaging"] + custom_ids, "GANHO": ["Won"], "PERDIDO": ["Lost"], "TODOS": ["Prospecting", "Engaging", "Won", "Lost"] + custom_ids}[status or "ABERTO"]
    selected_all = pd.concat([frame, closed], ignore_index=True)
    selected = selected_all[selected_all["pipeline_stage"].isin(stages)]
    with totals:
        st.caption(f"{len(selected)} oportunidades · US$ {selected['sales_price'].sum():,.0f}")
    st.markdown("""<style>
    .st-key-pipeline_board { overflow-x:auto; align-items:flex-start; padding-bottom:.5rem; }
    [class*="st-key-pipeline_slot_"] { padding:.7rem; border-top:3px solid var(--g4-gold-500); background:var(--g4-navy-900); }
    .st-key-pipeline_board > div:has(> [class*="st-key-pipeline_slot_"]) { flex:0 0 235px !important; min-width:235px; }
    .stApp:has(.pipeline-mode-ABERTO) .st-key-pipeline_board > div:has(> [class*="st-key-pipeline_slot_"]) { flex-basis:350px !important; min-width:350px; }
    .stApp:has(.pipeline-mode-ABERTO) .st-key-pipeline_board > div:has(.stage-kind-closed),
    .stApp:has(.pipeline-mode-GANHO) .st-key-pipeline_board > div:not(:has(.stage-code-Won)),
    .stApp:has(.pipeline-mode-PERDIDO) .st-key-pipeline_board > div:not(:has(.stage-code-Lost)) { display:none; }
    .stApp:has(.pipeline-mode-GANHO) .st-key-pipeline_board > div:has(.stage-code-Won),
    .stApp:has(.pipeline-mode-PERDIDO) .st-key-pipeline_board > div:has(.stage-code-Lost) { flex-basis:650px !important; min-width:650px; }
    .stApp:has(.pipeline-mode-GANHO) .st-key-pipeline_board,
    .stApp:has(.pipeline-mode-PERDIDO) .st-key-pipeline_board { max-width:680px; margin-inline:auto; }
    [class*="st-key-pipeline_"] [data-testid="stVerticalBlockBorderWrapper"] { border-radius: .6rem; }
    [class*="st-key-pipeline_"] [data-testid="stButton"] button { min-height: 1.7rem; height: 1.7rem; font-size: .76rem; }
    .crm-score { font-weight: 800; font-size: 1.55rem; line-height: 1.1; color: var(--g4-gold-300); }
    .crm-score span { font-size: .68rem; font-weight: 500; opacity: .62; margin-left: 2px; }
    .crm-account { font-size: .96rem; font-weight: 700; line-height: 1.2; margin-top: .25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .crm-product, .crm-seller, .crm-tags, .crm-next, .crm-footer { font-size: .72rem; line-height: 1.25; opacity: .82; margin-top: .22rem; }
    .crm-action { font-size: .78rem; font-weight: 700; line-height: 1.2; margin-top: .42rem; }
    .crm-tags { color: var(--g4-gold-300); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .crm-next { color: var(--g4-neutral-100); }
    .crm-footer { opacity: .58; border-top: 1px solid rgba(131,144,156,.25); padding-top: .28rem; margin-top: .4rem; }
    </style>""", unsafe_allow_html=True)
    all_stages = [("Prospecting", "Prospecção", "open"), ("Engaging", "Em negociação", "open"), ("Won", "Ganho", "closed"), ("Lost", "Perdido", "closed")] + [(item["stage_id"], item["name"], "custom") for item in custom_stages]
    def render_stage(stage, stage_name):
        subset = selected_all[selected_all["pipeline_stage"] == stage]
        subset = subset.sort_values("opportunity_id") if stage in ("Won", "Lost") else kanban_order(subset)
        if stage == "Engaging":
            heading, add = st.columns([5, 1], vertical_alignment="center")
            heading.markdown(f"#### {stage_name.upper()}")
            if add.button("+", key="add_pipeline_stage", help="Adicionar etapa"):
                st.session_state["adding_pipeline_stage"] = True
            if st.session_state.get("adding_pipeline_stage"):
                with st.form("new_pipeline_stage"):
                    new_stage = st.text_input("Nome da nova etapa")
                    if st.form_submit_button("Criar etapa"):
                        try:
                            state.create_pipeline_stage(new_stage)
                            st.session_state["adding_pipeline_stage"] = False
                            st.rerun()
                        except ValueError as exc:
                            st.error(str(exc))
        else:
            st.markdown(f"#### {stage_name.upper()}")
        st.caption(f"{len(subset)} oportunidades · US$ {subset['sales_price'].sum():,.0f}")
        if subset.empty:
            return
        limit_key = f"pipeline_limit_{stage}"
        limit = st.session_state.get(limit_key, 6)
        for _, row in subset.head(limit).iterrows():
            _card(row, custom_stages)
        if limit < len(subset) and st.button("Carregar mais", key=f"auto_load_pipeline_{stage}"):
            st.session_state[limit_key] = limit + 6
            st.rerun()

    with st.container(horizontal=True, wrap=False, gap="small", key="pipeline_board"):
        st.markdown(f"<div class='pipeline-mode-{status or 'ABERTO'}' style='display:none'>pipeline</div>", unsafe_allow_html=True)
        for slot, (stage, stage_name, kind) in enumerate(all_stages):
            with st.container(border=True, height=650, width="stretch", key=f"pipeline_slot_{slot}"):
                safe_stage = re.sub(r"[^A-Za-z0-9_-]", "-", stage)
                st.markdown(f"<span class='stage-kind-{kind} stage-code-{safe_stage}' style='display:none'>stage</span>", unsafe_allow_html=True)
                render_stage(stage, stage_name)

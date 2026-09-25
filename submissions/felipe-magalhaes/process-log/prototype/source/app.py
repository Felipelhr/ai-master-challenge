from __future__ import annotations

from datetime import date, datetime, time
from html import escape
import re
import uuid
from zoneinfo import ZoneInfo

import pandas as pd
import streamlit as st

import crm_state as state
from about import render_about
from crm_views import kanban, opportunity_dialog
from digest_service import generate_priority_digest
from email_schedules import TIMEZONE, delete_schedule, list_schedules, save_schedule, set_schedule_enabled, snapshot_digest_rows
from email_service import EmailService
from labels import label, labels
from scoring.engine import score_new_opportunity, score_snapshot
from scoring.model import load_data
from ui import G4_THEME_CSS, enrich_operational, export_visible, filter_table, kanban_order, next_task_summary, priority_reason_short

st.set_page_config(page_title="Lead Priority Engine", layout="wide")
state.connect().close()
st.markdown(G4_THEME_CSS, unsafe_allow_html=True)
st.html("""<script>
try {
  const host = window.parent;
  host.document.documentElement.dataset.lrmSidebarScript = "ran";
  const key = "lrm.sidebar.width";
  const initialKey = "lrm.sidebar.initial";
  const setup = () => {
  const sidebar = host.document.querySelector('[data-testid="stSidebar"]');
  const handle = sidebar?.querySelector('[data-testid="stSidebarResizeHandle"]');
  if (!sidebar || !handle) { host.setTimeout(setup, 200); return; }
  if (sidebar && handle && !host.__lrmSidebarWidth) {
    const stored = Number(host.localStorage.getItem(key));
    const initial = Number(host.sessionStorage.getItem(initialKey)) || Math.round(host.innerWidth * .24);
    host.sessionStorage.setItem(initialKey, String(initial));
    const control = {manual: stored > 0, preferred: stored > 0 ? stored : initial, dragging: false};
    host.__lrmSidebarWidth = control;
    const fit = () => {
      const maximum = Math.max(252, Math.min(600, host.innerWidth - (host.innerWidth > 800 ? 520 : 48)));
      return Math.max(252, Math.min(control.preferred, maximum));
    };
    const apply = () => {
      if (!control.dragging) {
        const width = fit() + "px";
        if (sidebar.style.width !== width) sidebar.style.width = width;
      }
    };
    handle.addEventListener("pointerdown", () => { control.dragging = true; });
    host.document.addEventListener("pointerup", () => {
      if (!control.dragging) return;
      control.dragging = false;
      control.preferred = parseFloat(sidebar.style.width) || fit();
      control.manual = true;
      host.localStorage.setItem(key, String(control.preferred));
      apply();
    });
    host.addEventListener("resize", apply);
    new MutationObserver(apply).observe(sidebar, {attributes:true, attributeFilter:["style"]});
    apply();
  }
  };
  setup();
  const bindLazyLoad = () => host.document.querySelectorAll('[class*="st-key-auto_load_"] button').forEach((button) => {
    if (button.dataset.lazyBound) return;
    button.dataset.lazyBound = "true";
    const observer = new host.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); button.click(); }
    }, {rootMargin: "280px"});
    observer.observe(button);
  });
  const lazyObserver = new host.MutationObserver(bindLazyLoad);
  lazyObserver.observe(host.document.body, {childList:true, subtree:true});
  bindLazyLoad();
} catch (_) { /* Keep Streamlit's native sidebar when browser access is restricted. */ }
</script>""", unsafe_allow_javascript=True)
st.markdown("<style>[data-testid='stSidebar'][aria-expanded='true'] {min-width:min(252px,calc(100vw - 48px))}</style>", unsafe_allow_html=True)


@st.cache_data
def scored_snapshot():
    return score_snapshot()


@st.cache_data
def source_data():
    return load_data()


def reset_filters():
    for key in list(st.session_state):
        if key.startswith("f_"):
            del st.session_state[key]


def explanation(value):
    return re.sub(r"(?<=\d)\.(?=\d+%)", ",", str(value).replace("`", ""))


def sidebar_filters(frame):
    with st.sidebar:
        st.button("Redefinir filtros", on_click=reset_filters, width="stretch")
        st.markdown("### Score de Prioridade")
        score = st.slider("Score de Prioridade", 0, 100, (0, 100), key="f_score", label_visibility="collapsed")
        all_tags = sorted({tag for tags in frame["System Tags"] for tag in tags} | {tag for tags in frame["User Tags"] for tag in tags})
        tags = st.multiselect("Tags Auxiliares", all_tags, format_func=label, key="f_tags")
        action = st.multiselect("Ação Recomendada", sorted(frame["Action Tag"].unique()), format_func=label, key="f_action")
        top5 = st.selectbox("Top 5 do vendedor", ["Todos", "Sim", "Não"], key="f_top5")
        confidence = st.multiselect("Confiança", sorted(frame["Confidence"].unique()), format_func=label, key="f_confidence")
        missing = st.selectbox("Conta incompleta", ["Todos", "Sim", "Não"], key="f_missing")
        seller = st.multiselect("Vendedor", sorted(frame["sales_agent"].dropna().unique()), key="f_seller")
        manager = st.multiselect("Manager", sorted(frame["manager"].dropna().unique()), key="f_manager")
        region = st.multiselect("Região", sorted(frame["regional_office"].dropna().unique()), key="f_region")
        product = st.multiselect("Produto", sorted(frame["product"].dropna().unique()), key="f_product")
        sector = st.multiselect("Setor", sorted(frame["sector"].dropna().unique()), key="f_sector")
        basis = st.multiselect("Critérios de Score", sorted(frame["Score Basis"].unique()), format_func=label, key="f_basis")
    choices = {"Action Tag": action, "Confidence": confidence, "sales_agent": seller, "manager": manager, "product": product, "sector": sector, "regional_office": region, "Score Basis": basis}
    visible = filter_table(frame, choices)
    visible = visible[visible["Priority Score"].between(*score) | ((score == (0, 100)) & visible["Priority Score"].isna())]
    if missing != "Todos":
        visible = visible[visible["account"].isna() == (missing == "Sim")]
    if top5 != "Todos":
        visible = visible[visible["System Tags"].map(lambda xs: ("TOP_5_SELLER" in xs) == (top5 == "Sim"))]
    if tags:
        visible = visible[visible.apply(lambda row: any(tag in row["System Tags"] + row["User Tags"] for tag in tags), axis=1)]
    scope = {
        "score": list(score), "tags": list(tags), "top5": top5, "missing": missing,
        "choices": {
            "Action Tag": list(action), "Confidence": list(confidence), "sales_agent": list(seller),
            "manager": list(manager), "product": list(product), "sector": list(sector),
            "regional_office": list(region), "Score Basis": list(basis),
        },
    }
    return visible, scope


created_opportunities = state.list_user_opportunities()
scored_frame = pd.concat([scored_snapshot(), created_opportunities], ignore_index=True, sort=False) if not created_opportunities.empty else scored_snapshot()
state.ensure_initial_tasks(scored_frame)
tasks = state.list_tasks()
user_tags = state.list_tags()
frame = enrich_operational(scored_frame, tasks, user_tags)
historical = source_data()[lambda d: d["deal_stage"].isin(["Won", "Lost"])].copy()
for field, value in [("Priority Score", None), ("Confidence", "—"), ("Action Tag", "Encerrada"), ("Score Basis", "HISTORICAL"), ("Auxiliary Tags", []), ("propensity_30d", None), ("age_days", None), ("reason", None), ("next_action", None), ("limitation", None)]:
    historical[field] = [list(value) for _ in range(len(historical))] if isinstance(value, list) else value
historical = enrich_operational(historical, tasks, user_tags)
custom_stages = state.list_pipeline_stages()
stage_overrides = state.list_stage_overrides()
stage_names = {item["stage_id"]: item["name"] for item in custom_stages}
for dataset in (frame, historical):
    dataset["pipeline_stage"] = dataset.apply(lambda row: stage_overrides.get(str(row["opportunity_id"]), row["deal_stage"]), axis=1)
    dataset["pipeline_stage_label"] = dataset["pipeline_stage"].map(lambda value: stage_names.get(value, label(value)))
combined = pd.concat([frame, historical], ignore_index=True)
filtered, filter_scope = sidebar_filters(combined)
visible = filtered[filtered["deal_stage"].isin(["Prospecting", "Engaging"])]
visible_closed = filtered[filtered["deal_stage"].isin(["Won", "Lost"])]

header, export_cta, email_cta = st.columns([4.8, 1.05, 1.05], vertical_alignment="center")
with header:
    st.title("Lead Priority Engine")
    st.caption("Score de Prioridade não representa percentual de chance de fechamento.")
with export_cta:
    with st.popover("Exportar para CRM", width="content"):
        st.markdown("**Exportar dados selecionados**")
        st.write("Baixe em CSV exatamente as oportunidades atualmente visíveis para importar no seu CRM, automação ou ferramenta de disparo.")
        st.download_button("Baixar CSV visível", export_visible(visible), "lead_priority_visible.csv", "text/csv", key="top_export")
with email_cta:
    with st.popover("Enviar por e-mail", width="content"):
        email_service = EmailService()
        automatic = st.checkbox("Envio automático", value=True, key="digest_automatic")
        schedules = list_schedules()
        selected_schedule = None
        if automatic:
            schedule_options = {"Novo agendamento": None} | {
                f"{item['recipient_email']} · {item['frequency']} · {item['id'][:6]}": item for item in schedules
            }
            selected_label = st.selectbox("Configuração", list(schedule_options), key="digest_schedule_choice")
            selected_schedule = schedule_options[selected_label]
        recipient = st.text_input(
            "Destinatário",
            value=selected_schedule["recipient_email"] if selected_schedule else "",
            placeholder="vendedor@empresa.com",
            key="digest_recipient",
        )
        if automatic:
            frequency_labels = {"Diário": "DAILY", "Semanal": "WEEKLY", "Mensal": "MONTHLY"}
            current_frequency = selected_schedule["frequency"] if selected_schedule else "DAILY"
            frequency_name = st.selectbox(
                "Frequência", list(frequency_labels),
                index=list(frequency_labels.values()).index(current_frequency), key="digest_frequency",
            )
            frequency = frequency_labels[frequency_name]
            send_at = st.time_input(
                "Horário", value=time.fromisoformat(selected_schedule["send_time"]) if selected_schedule else time(8, 0),
                step=900, key="digest_send_time",
            )
            weekday = None
            day_of_month = None
            if frequency == "WEEKLY":
                weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
                weekday = st.selectbox(
                    "Dia da semana", range(7),
                    index=int(selected_schedule["weekday"]) if selected_schedule and selected_schedule["weekday"] is not None else 0,
                    format_func=lambda value: weekdays[value], key="digest_weekday",
                )
            elif frequency == "MONTHLY":
                day_of_month = st.number_input(
                    "Dia do mês", 1, 31,
                    int(selected_schedule["day_of_month"]) if selected_schedule and selected_schedule["day_of_month"] else 1,
                    key="digest_month_day",
                )
            st.caption("Horário de Brasília · America/Sao_Paulo")
            if st.button("Salvar agendamento", width="stretch", key="digest_schedule_save"):
                try:
                    save_schedule(
                        recipient, frequency, send_at,
                        filter_scope | {"digest_rows": snapshot_digest_rows(visible)},
                        weekday, day_of_month,
                        selected_schedule["id"] if selected_schedule else None,
                    )
                    st.success("Agendamento salvo.")
                    st.rerun()
                except ValueError as exc:
                    st.error(str(exc))
        current_digest = generate_priority_digest(visible)
        if st.button("Pré-visualizar", width="stretch", key="digest_preview"):
            st.session_state["digest_preview_content"] = current_digest
        preview = st.session_state.get("digest_preview_content")
        if preview:
            st.text_area("Pré-visualização", preview["text"], height=280, disabled=True)
        if not email_service.is_configured:
            message = "Envio desabilitado. Configure RESEND_API_KEY e RESEND_FROM_EMAIL. A pré-visualização continua disponível."
            if schedules:
                message += " O agendamento fica salvo, mas depende dessas credenciais e do worker ativo."
            st.info(message)
        if st.button("Enviar agora", width="stretch", key="digest_send", disabled=not email_service.is_configured):
            if "@" not in recipient:
                st.error("Informe um destinatário válido.")
            else:
                try:
                    result = email_service.send_digest(recipient, current_digest)
                    st.success(f"Resumo enviado. ID: {result.get('id', 'confirmado')}")
                except Exception as exc:
                    st.error(f"Não foi possível enviar: {exc}")
        if automatic and schedules:
            st.markdown("**Agendamentos salvos**")
            zone = ZoneInfo(TIMEZONE)
            for schedule in schedules:
                next_run = datetime.fromisoformat(schedule["next_run_at"]).astimezone(zone).strftime("%d/%m/%Y às %H:%M")
                last_sent = (
                    datetime.fromisoformat(schedule["last_sent_at"]).astimezone(zone).strftime("%d/%m/%Y às %H:%M")
                    if schedule["last_sent_at"] else "Nunca enviado"
                )
                state_label = "Ativo" if schedule["enabled"] else "Pausado"
                with st.expander(f"{state_label} · {schedule['recipient_email']} · {schedule['frequency']}"):
                    st.caption(f"Próximo envio: {next_run} · Último envio: {last_sent}")
                    left, right = st.columns(2)
                    if left.button("Pausar" if schedule["enabled"] else "Reativar", key=f"schedule_toggle_{schedule['id']}"):
                        set_schedule_enabled(schedule["id"], not schedule["enabled"])
                        st.rerun()
                    if right.button("Excluir", key=f"schedule_delete_{schedule['id']}"):
                        delete_schedule(schedule["id"])
                        st.rerun()

listing, pipeline, new, methods, dashboard = st.tabs(["Lista", "Pipeline", "Pontuar Nova Oportunidade", "Como funciona", "Dashboard"])
with pipeline:
    kanban(visible, visible_closed, custom_stages)

with listing:
    st.subheader("Oportunidades")
    st.caption(f"{len(visible)} oportunidades após os filtros")
    list_frame = kanban_order(visible)
    list_limit = st.session_state.get("list_limit", 20)
    st.markdown("""<style>
    .st-key-crm_list_table {overflow-x:auto}
    .st-key-crm_list_table [data-testid="stHorizontalBlock"] {flex-wrap:nowrap;min-width:1900px;align-items:center;border-bottom:1px solid rgba(131,144,156,.22);padding:.3rem 0}
    .st-key-crm_list_table [data-testid="stColumn"] {min-width:0}
    .st-key-crm_list_table [data-testid="stButton"] button {font-size:.78rem;white-space:nowrap}
    .st-key-crm_list_table p {font-size:.78rem;line-height:1.3;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    </style>""", unsafe_allow_html=True)
    fields = ["Oportunidade", "Score de Prioridade", "O que fazer", "Por que priorizar", "Próxima tarefa", "Confiança", "Conta", "Produto", "Valor", "Vendedor", "Manager", "Região", "Tags"]
    widths = [1.3, .8, 1.25, 2.3, 1.6, .75, 1.15, 1, .75, 1.05, 1.05, .8, 1.3]
    with st.container(key="crm_list_table"):
        for col, heading in zip(st.columns(widths, gap="small"), fields):
            col.markdown(f"**{heading}**")
        for _, row in list_frame.head(list_limit).iterrows():
            columns = st.columns(widths, gap="small")
            oid = row["opportunity_id"]
            if columns[0].button(f"Abrir · {oid}", key=f"list_{oid}"):
                opportunity_dialog(row, custom_stages)
            values = [
                str(int(row["Priority Score"])), label(row["Action Tag"]), priority_reason_short(row),
                next_task_summary(row), label(row["Confidence"]),
                row["account"] if pd.notna(row["account"]) else "Conta não identificada",
                row["product"], f"US$ {row['sales_price']:,.0f}", row["sales_agent"], row["manager"],
                row["regional_office"], ", ".join(labels(row["System Tags"]) + row["User Tags"]),
            ]
            for index, (col, value) in enumerate(zip(columns[1:], values)):
                css_class = {0: "g4-score", 1: "g4-action", 2: "g4-reason"}.get(index)
                if css_class:
                    col.markdown(f"<span class='{css_class}'>{escape(str(value))}</span>", unsafe_allow_html=True)
                else:
                    col.caption(str(value))
        if list_limit < len(list_frame) and st.button("Carregar mais oportunidades", key="auto_load_list"):
            st.session_state["list_limit"] = list_limit + 20
            st.rerun()
    st.download_button("Baixar CSV visível", export_visible(visible), "lead_priority_visible.csv", "text/csv", key="table_export")

with new:
    catalog = source_data()
    products = sorted(catalog["product"].unique())
    sellers = sorted(catalog["sales_agent"].unique())
    accounts = sorted(catalog["account"].dropna().unique())
    new_account_option = "+ Nova Oportunidade"
    account = st.selectbox("Conta cadastrada (opcional)", [new_account_option] + accounts)
    source = catalog[catalog["account"] == account].iloc[0] if account != new_account_option else None
    with st.form("new_opportunity"):
        stage = st.selectbox("Etapa", ["Engaging", "Prospecting"], format_func=label)
        product = st.selectbox("Produto", products)
        seller = st.selectbox("Vendedor", sellers)
        engage_date = st.date_input("Data de entrada em negociação", value=date(2017, 12, 1))
        as_of_date = st.date_input("Data de referência", value=date(2017, 12, 31))
        if source is not None:
            st.caption("Dados firmográficos da conta cadastrada; ajuste se necessário.")
            sector = st.text_input("Setor", value=str(source["sector"]))
            revenue = st.number_input("Receita anual da empresa (milhões de USD)", min_value=0.0, value=float(source["revenue"]))
            employees = st.number_input("Funcionários", min_value=0, value=int(source["employees"]))
            year_established = st.number_input("Ano de fundação", min_value=1800, max_value=as_of_date.year, value=int(source["year_established"]))
            subsidiary_of = st.text_input("Subsidiária de", value="" if pd.isna(source["subsidiary_of"]) else str(source["subsidiary_of"]))
        else:
            st.caption("Sem conta cadastrada, a negociação usa a estimativa por faixa de idade.")
        calculate_col, create_col = st.columns(2)
        submitted = calculate_col.form_submit_button("Calcular Prioridade", width="stretch")
        create_new = create_col.form_submit_button("Criar Novo", width="stretch")
    if submitted or create_new:
        opportunity_id = f"NEW-{uuid.uuid4().hex[:8].upper()}" if create_new else "NEW-OPPORTUNITY"
        values = {"opportunity_id": opportunity_id, "sales_agent": seller, "product": product, "account": account if account != new_account_option else None, "deal_stage": stage, "engage_date": engage_date if stage == "Engaging" else pd.NaT}
        values.update({"sector": sector, "revenue": revenue, "employees": employees, "year_established": year_established, "subsidiary_of": subsidiary_of or None} if source is not None else {field: None for field in ["sector", "revenue", "employees", "year_established", "subsidiary_of"]})
        try:
            result = score_new_opportunity(values, scored_snapshot(), as_of_date).iloc[0]
            st.metric("Score de Prioridade", f"{result['Priority Score']}/100")
            st.write(f"**Base do Score:** {label(result['Score Basis'])} · **Confiança:** {label(result['Confidence'])} · **Ação:** {label(result['Action Tag'])}")
            st.write(f"**Tags:** {', '.join(labels(result['Auxiliary Tags']))}")
            st.write("**Motivo:** " + explanation(result["reason"]))
            st.write("**Próxima ação:** " + explanation(result["next_action"]))
            st.write("**Limitação:** " + explanation(result["limitation"]))
            if create_new:
                state.create_user_opportunity(result)
                state.ensure_initial_tasks(pd.DataFrame([result]))
                st.success(f"Oportunidade {opportunity_id} criada com score, tags e tarefa inicial.")
        except ValueError as exc:
            st.error(str(exc))

with methods:
    render_about()

with dashboard:
    st.subheader("Dashboard")
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Oportunidades visíveis", len(filtered))
    k2.metric("Abertas visíveis", len(visible))
    k3.metric("Valor visível", f"US$ {filtered['sales_price'].sum():,.0f}")
    k4.metric("Tarefas pendentes", int(filtered["pending_task_count"].sum()))
    charts = [
        ("Etapas", "pipeline_stage_label"),
        ("Ação recomendada", "Action Tag"),
        ("Critérios de Score", "Score Basis"),
        ("Produto", "product"),
        ("Setor", "sector"),
        ("Regional", "regional_office"),
    ]
    for left_index in range(0, len(charts), 2):
        columns = st.columns(2)
        for column, (heading, field) in zip(columns, charts[left_index:left_index + 2]):
            with column:
                st.markdown(f"**{heading}**")
                counts = filtered[field].fillna("Não informado").map(label).value_counts()
                st.bar_chart(counts)
    st.markdown("**Confiança do Score — oportunidades abertas**")
    st.bar_chart(visible["Confidence"].map(label).value_counts())

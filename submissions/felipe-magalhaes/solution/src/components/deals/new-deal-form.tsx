"use client";

import { useState } from "react";
import type { CrmDeal } from "@/domain/deals/deal";
import { calculateLeadTier } from "@/domain/tiering/lead-tier";
import { DEFAULT_FUNNEL_ID, type Funnel, type PipelineStage } from "@/domain/pipeline/stage";
import { scoringSnapshotDate } from "@/domain/scoring/engine";
import type { ProductOption } from "@/components/priority/score-opportunity";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Mutate } from "./operations-panels";

export function NewDealForm({ open, onClose, products, sectors, funnels, stages, deals, pending, mutate, onCreated }: { open: boolean; onClose: () => void; products: ProductOption[]; sectors: string[]; funnels: Funnel[]; stages: PipelineStage[]; deals: CrmDeal[]; pending: boolean; mutate: Mutate; onCreated: (id: string) => void }) {
  const [account, setAccount] = useState(""); const [product, setProduct] = useState(""); const [agent, setAgent] = useState("");
  const [manager, setManager] = useState(""); const [region, setRegion] = useState(""); const [funnelId, setFunnelId] = useState(DEFAULT_FUNNEL_ID); const [stageId, setStageId] = useState("prospecting");
  const [engageDate, setEngageDate] = useState(""); const [accountKnown, setAccountKnown] = useState(false); const [sector, setSector] = useState("");
  const [revenue, setRevenue] = useState(""); const [employees, setEmployees] = useState(""); const [yearEstablished, setYearEstablished] = useState("");
  const [subsidiaryOf, setSubsidiaryOf] = useState(""); const [error, setError] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const selectedProduct = products.find((item) => item.name === product);
  const sellers = Array.from(new Set(deals.map((deal) => deal.agent))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const num = (value: string) => value.trim() ? Number(value) : null;
  const tierPreview = selectedProduct ? calculateLeadTier({
    id: "PREVIEW", account: account || "Conta não informada", accountKnown, sector: sector || null,
    revenue: accountKnown ? num(revenue) : null, employees: accountKnown ? num(employees) : null,
    yearEstablished: accountKnown ? num(yearEstablished) : null, subsidiaryOf: subsidiaryOf || null,
    officeLocation: accountKnown ? officeLocation || null : null, agent, manager, region,
    product: selectedProduct.name, series: selectedProduct.series, stage: "Prospecting",
    value: selectedProduct.price, salesPrice: selectedProduct.price, engageDate: null, closeDate: null,
  }) : null;
  async function submit() {
    setError("");
    try {
      const snapshot = await mutate({ kind: "deal.create", input: {
        account, product, series: selectedProduct?.series ?? "Não informada", salesPrice: selectedProduct?.price ?? 0,
        agent, manager, region, funnelId, stageId, engageDate: engageDate || null, accountKnown,
        sector: sector || null, revenue: accountKnown ? num(revenue) : null, employees: accountKnown ? num(employees) : null, yearEstablished: accountKnown ? num(yearEstablished) : null, subsidiaryOf: accountKnown ? subsidiaryOf || null : null, officeLocation: accountKnown ? officeLocation || null : null,
      } });
      const created = snapshot.deals.find((deal) => deal.isNew && !deals.some((before) => before.id === deal.id));
      if (created) onCreated(created.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar a oportunidade."); }
  }
  return <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}><SheetContent className="new-deal-sheet">
    <SheetTitle>Nova oportunidade</SheetTitle><SheetDescription>Cria um negócio real no CRM local, calcula o score congelado e gera a tarefa inicial. Para simular sem salvar, use Pontuar Oportunidade.</SheetDescription>
    <div className="new-deal-scroll"><div className="new-deal-grid">
      <label>Conta <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Nome da conta" /></label>
      <label>Produto <select value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Selecione</option>{products.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      <label>Vendedor <input list="sellers" value={agent} onChange={(event) => setAgent(event.target.value)} placeholder="Nome do vendedor" /><datalist id="sellers">{sellers.map((item) => <option key={item} value={item} />)}</datalist></label>
      <label>Manager <input value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Opcional" /></label>
      <label>Região <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Opcional" /></label>
      <label>Funil <select value={funnelId} onChange={(event) => { const id = event.target.value; setFunnelId(id); setStageId(stages.find((stage) => stage.active && stage.funnelId === id && stage.category === "OPEN")?.id ?? ""); }}>{funnels.map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}</select></label>
      <label>Etapa <select value={stageId} onChange={(event) => setStageId(event.target.value)}><option value="">Selecione</option>{stages.filter((stage) => stage.active && stage.category === "OPEN" && stage.funnelId === funnelId).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
      <label>Entrada em negociação <input type="date" max={scoringSnapshotDate} value={engageDate} onChange={(event) => setEngageDate(event.target.value)} /></label>
      <label>Setor <select value={sector} onChange={(event) => setSector(event.target.value)}><option value="">Não informado</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="account-toggle"><input type="checkbox" checked={accountKnown} onChange={(event) => setAccountKnown(event.target.checked)} /> Conta com dados firmográficos</label>
      {accountKnown && <><label>Receita <input type="number" min="0" value={revenue} onChange={(event) => setRevenue(event.target.value)} /></label><label>Funcionários <input type="number" min="0" value={employees} onChange={(event) => setEmployees(event.target.value)} /></label><label>Ano de fundação <input type="number" min="1800" max="2017" value={yearEstablished} onChange={(event) => setYearEstablished(event.target.value)} /></label><label>Localização do escritório <input value={officeLocation} onChange={(event) => setOfficeLocation(event.target.value)} placeholder="Opcional" /></label><label>Subsidiária de <input value={subsidiaryOf} onChange={(event) => setSubsidiaryOf(event.target.value)} /></label></>}
    </div>{tierPreview && <div className="tier-preview"><span>Lead Tier estimado</span><strong>{tierPreview.tier}</strong><small>Classificação comercial. O Score de Prioridade será calculado ao criar.</small></div>}<p className="snapshot-hint">O modelo foi congelado em {scoringSnapshotDate}. Datas posteriores não são pontuadas nesta versão.</p>{error && <p className="form-error" role="alert">{error}</p>}</div>
    <div className="new-deal-actions"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button className="arena-primary" onClick={submit} disabled={pending || !account.trim() || !product || !agent.trim() || !stageId}>Criar oportunidade</Button></div>
  </SheetContent></Sheet>;
}

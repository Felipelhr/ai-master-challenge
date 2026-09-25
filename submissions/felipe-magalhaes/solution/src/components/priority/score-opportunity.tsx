"use client";

import { useState, type FormEvent } from "react";
import type { Deal } from "@/domain/deals/deal";
import { scoringSnapshotDate } from "@/domain/scoring/engine";
import { scoreNewOpportunity } from "@/services/scoring/score-snapshot";
import type { PriorityResult } from "@/domain/scoring/scoring-engine";
import { calculateLeadTier, type LeadTierResult } from "@/domain/tiering/lead-tier";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntelligencePanel } from "./intelligence-panel";

export interface ProductOption {
  name: string;
  series: string;
  price: number;
}

export function ScoreOpportunity({ products, sectors }: { products: ProductOption[]; sectors: string[] }) {
  const [stage, setStage] = useState<"Prospecting" | "Engaging">("Engaging");
  const [productName, setProductName] = useState(products[0]?.name ?? "");
  const [engageDate, setEngageDate] = useState("2017-12-01");
  const [accountKnown, setAccountKnown] = useState(false);
  const [sector, setSector] = useState("");
  const [revenue, setRevenue] = useState("");
  const [employees, setEmployees] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [subsidiary, setSubsidiary] = useState(false);
  const [officeLocation, setOfficeLocation] = useState("");
  const [result, setResult] = useState<PriorityResult | null>(null);
  const [tier, setTier] = useState<LeadTierResult | null>(null);
  const [error, setError] = useState("");

  const product = products.find((entry) => entry.name === productName);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!product) return setError("Selecione um produto.");
    if (stage === "Engaging" && (!engageDate || engageDate > scoringSnapshotDate)) return setError("Informe uma data de entrada em negociação até 31/12/2017.");

    const deal: Deal = {
      id: "SIMULACAO", account: accountKnown ? "Conta simulada" : "Conta não informada", accountKnown,
      sector: accountKnown && sector ? sector : null,
      revenue: accountKnown && revenue ? Number(revenue) : null,
      employees: accountKnown && employees ? Number(employees) : null,
      yearEstablished: accountKnown && yearEstablished ? Number(yearEstablished) : null,
      subsidiaryOf: accountKnown && subsidiary ? "Subsidiária" : null,
      officeLocation: accountKnown && officeLocation ? officeLocation : null,
      agent: "", manager: "", region: "", product: product.name, series: product.series,
      stage, value: product.price, salesPrice: product.price,
      engageDate: stage === "Engaging" ? engageDate : null, closeDate: null,
    };
    try {
      setResult(scoreNewOpportunity(deal));
      setTier(calculateLeadTier(deal));
    } catch {
      setError("Não foi possível pontuar esta combinação de dados. Confira a data informada.");
      setResult(null);
      setTier(null);
    }
  }

  return <div className="score-page">
    <div className="score-page-intro"><h2>Pontuar Oportunidade</h2><p>Simule a prioridade de um novo negócio no snapshot de 31/12/2017.</p><span>Simulação com o modelo atual. Não realiza retraining.</span></div>
    <div className="score-page-grid">
      <form className="score-form" onSubmit={onSubmit} onChange={() => { setResult(null); setTier(null); setError(""); }}>
        <h3>Dados da oportunidade</h3>
        <div className="score-form-grid">
          <label>Etapa<select value={stage} onChange={(event) => setStage(event.target.value as "Prospecting" | "Engaging")}><option value="Engaging">Em negociação</option><option value="Prospecting">Prospecção</option></select></label>
          <label>Produto<select value={productName} onChange={(event) => setProductName(event.target.value)}>{products.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></label>
          {stage === "Engaging" && <label>Entrada em negociação<Input type="date" value={engageDate} max={scoringSnapshotDate} onChange={(event) => setEngageDate(event.target.value)} required /></label>}
          <div className="form-value"><span>Preço sugerido do produto</span><strong>{product ? currency.format(product.price) : "—"}</strong></div>
        </div>
        <div className="account-fields">
          <label className="account-toggle"><input type="checkbox" checked={accountKnown} onChange={(event) => setAccountKnown(event.target.checked)} /><span>Conta identificada</span></label>
          <p>{accountKnown ? "Os campos não informados usam referência neutra no Lead Tier; o score mantém sua própria regra validada." : "Sem conta identificada, o Lead Tier usa porte neutro e indica menor completude."}</p>
          {accountKnown && <div className="score-form-grid">
            <label>Setor<select value={sector} onChange={(event) => setSector(event.target.value)}><option value="">Não informado</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Receita anual (milhões de USD)<Input type="number" min="0" step="0.01" value={revenue} onChange={(event) => setRevenue(event.target.value)} placeholder="Opcional" /></label>
            <label>Funcionários<Input type="number" min="0" step="1" value={employees} onChange={(event) => setEmployees(event.target.value)} placeholder="Opcional" /></label>
            <label>Ano de fundação<Input type="number" min="1800" max="2017" step="1" value={yearEstablished} onChange={(event) => setYearEstablished(event.target.value)} placeholder="Opcional" /></label>
            <label>Localização do escritório<Input value={officeLocation} onChange={(event) => setOfficeLocation(event.target.value)} placeholder="Opcional" /></label>
            <label className="account-toggle"><input type="checkbox" checked={subsidiary} onChange={(event) => setSubsidiary(event.target.checked)} /><span>É subsidiária</span></label>
          </div>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" className="score-submit">Calcular prioridade</Button>
      </form>
      <div className="score-result">{result ? <IntelligencePanel result={result} tier={tier} /> : <div className="score-empty"><strong>Resultado da simulação</strong><p>Preencha os dados e calcule a prioridade. Lead Tier é classificação comercial; Score de Prioridade organiza o trabalho.</p></div>}</div>
    </div>
  </div>;
}

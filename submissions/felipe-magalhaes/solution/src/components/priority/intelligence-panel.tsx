import { hasTemporalScore, priorityExplanation, priorityQueue, QUEUE_LABELS } from "@/domain/scoring/priority-queue";
import { ArrowRight, ChartNoAxesCombined, CircleHelp, Sparkles } from "lucide-react";
import { ACTION_LABELS, CONFIDENCE_LABELS, EVIDENCE_HELP, SCORE_BASIS_LABELS, SIGNAL_LABELS } from "@/domain/scoring/labels";
import type { PriorityResult } from "@/domain/scoring/scoring-engine";
import type { LeadTierResult } from "@/domain/tiering/lead-tier";
import { currency } from "@/lib/format";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function IntelligencePanel({ result, tier }: { result: PriorityResult | null; tier?: LeadTierResult | null }) {
  if (!result) return <section className="workspace-section"><div className="section-heading"><Sparkles size={19} /><h3>Inteligência comercial</h3></div><p className="section-lead">Lead Tier classifica potencial comercial, mesmo para negócios encerrados.</p><TierExplanation tier={tier ?? null} /><div className="module-empty">Negócio encerrado · não há Score de Prioridade operacional atual.</div></section>;

  return <section className="workspace-section intelligence-panel">
    <div className="section-heading"><Sparkles size={19} /><h3>Inteligência comercial</h3></div>
    <p className="section-lead">Score organiza o trabalho; Lead Tier descreve potencial comercial; qualidade da evidência informa o suporte do cálculo; ação indica o próximo passo.</p>
    <div className="intelligence-hero">
      <div><span>{QUEUE_LABELS[priorityQueue(result)!]}</span>{hasTemporalScore(result) ? <strong>{result.priorityScore}<small>/100 nesta fila</small></strong> : <strong className="confidence-value">Por valor</strong>}<p>{hasTemporalScore(result) ? "Prioridade relativa somente em Venda ativa." : "Sem Score temporal. Ordenação econômica dentro desta fila."}</p></div>
      <div title={EVIDENCE_HELP}><span>QUALIDADE DA EVIDÊNCIA ⓘ</span><strong className="confidence-value">{CONFIDENCE_LABELS[result.confidence]}</strong><p>Suporte informacional relativo; não é probabilidade.</p></div>
    </div>
    <TierExplanation tier={tier ?? null} />
    <div className="intelligence-detail-grid">
      <div className="intelligence-detail"><span><ChartNoAxesCombined size={16} /> {hasTemporalScore(result) ? "CRITÉRIO DO SCORE" : "BASE DA FILA"}</span><strong>{SCORE_BASIS_LABELS[result.scoreBasis]}</strong></div>
      <div className="intelligence-detail"><span><ArrowRight size={16} /> AÇÃO RECOMENDADA</span><strong>{ACTION_LABELS[result.action]}</strong></div>
    </div>
    <div className="explanation-block"><span>POR QUE ESTA PRIORIDADE?</span><p>{priorityExplanation(result)}</p><small>{result.limitation}</small></div>
    <div className="next-action-block"><span>PRÓXIMA AÇÃO</span><strong>{result.nextAction}</strong></div>
    {(result.propensity30d !== undefined || result.priorityValue !== undefined) && <div className="intelligence-detail-grid">
      {result.propensity30d !== undefined && <div className="intelligence-detail"><span>ESTIMATIVA DE VITÓRIA EM 30 DIAS</span><strong>{percent.format(result.propensity30d)}</strong><small>Estimativa histórica, não garantia de fechamento.</small></div>}
      {result.priorityValue !== undefined && <div className="intelligence-detail"><span>VALOR PONDERADO</span><strong>{currency.format(result.priorityValue)}</strong><small>Estimativa × preço sugerido do produto.</small></div>}
    </div>}
    <div className="system-signals"><span><CircleHelp size={16} /> SINAIS DO SISTEMA</span><div>{result.systemSignals.map((signal) => <span key={signal}>{SIGNAL_LABELS[signal]}</span>)}</div></div>
  </section>;
}

function TierExplanation({ tier }: { tier: LeadTierResult | null }) {
  if (!tier) return null;
  return <div className="tier-explanation" title="Classificação comercial baseada em potencial econômico, porte da conta e qualidade das informações disponíveis. Não representa probabilidade de fechamento."><div><span>LEAD TIER · HEURÍSTICA</span><strong>{tier.tier}</strong></div><p>Potencial econômico: {tier.components.economicLabel} · Porte da empresa: {tier.components.companySizeLabel} · Completude cadastral: {tier.components.completenessLabel}</p></div>;
}

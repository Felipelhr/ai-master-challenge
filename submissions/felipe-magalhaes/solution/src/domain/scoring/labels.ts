import type { ActionCode, ScoreBasis, ScoreConfidence, SystemSignal } from "./scoring-engine";

export const SCORE_BASIS_LABELS: Record<ScoreBasis, string> = {
  MODEL_FULL: "Modelo completo",
  AGE_ONLY_FALLBACK: "Estimativa por faixa de idade",
  OUT_OF_COVERAGE_VALUE: "Prioridade fora da cobertura histórica",
  PROSPECTING_VALUE: "Prioridade por valor em prospecção",
};

export const CONFIDENCE_LABELS: Record<ScoreConfidence, string> = {
  MEDIUM: "Maior",
  LOW: "Menor",
};

export const EVIDENCE_HELP = "Indica o nível relativo de suporte informacional disponível para este cálculo. 'Maior' não significa certeza de fechamento e 'Menor' não significa oportunidade ruim.";

export const ACTION_LABELS: Record<ActionCode, string> = {
  ACTION_WORK_NOW: "Trabalhar agora",
  ACTION_ENRICH_ACCOUNT: "Enriquecer dados da conta",
  ACTION_LAST_CONTACT_BEFORE_FREEZE: "Revalidar por contato",
  ACTION_QUALIFY_PROSPECTING: "Qualificar oportunidade",
};

export const SIGNAL_LABELS: Record<SystemSignal, string> = {
  MODEL_FULL: "Dados da conta disponíveis",
  ACCOUNT_MISSING: "Conta sem dados cadastrais",
  AGE_ONLY_FALLBACK: "Estimativa somente pela idade",
  OUT_OF_COVERAGE_AGE: "Além da cobertura histórica",
  PROSPECTING_NO_ENGAGE_DATE: "Ainda sem entrada em negociação",
  LOW_SUPPORT_AGE_121_138: "Menor suporte histórico entre 121 e 138 dias",
};

"""PT-BR display labels. Internal codes remain unchanged."""

LABELS = {
    "ACTION_WORK_NOW": "Trabalhar agora",
    "ACTION_ENRICH_ACCOUNT": "Enriquecer dados da conta",
    "ACTION_LAST_CONTACT_BEFORE_FREEZE": "Última tentativa antes de congelar",
    "ACTION_QUALIFY_PROSPECTING": "Qualificar oportunidade",
    "MODEL_FULL": "Modelo completo",
    "AGE_ONLY_FALLBACK": "Estimativa por faixa de idade",
    "OUT_OF_COVERAGE_VALUE": "Prioridade fora da cobertura histórica",
    "PROSPECTING_VALUE": "Prioridade por valor em prospecção",
    "ACCOUNT_MISSING": "Conta com dados incompletos",
    "OUT_OF_COVERAGE_AGE": "Idade fora da cobertura histórica",
    "PROSPECTING_NO_ENGAGE_DATE": "Prospecção sem data de engajamento",
    "LOW_SUPPORT_AGE_121_138": "Baixo suporte histórico — 121 a 138 dias",
    "TOP_5_SELLER": "Top 5 do vendedor",
    "FOLLOWUP_AUTOMATIZADO": "Follow-up automatizado",
    "LOW": "Baixa",
    "MEDIUM": "Média",
    "Prospecting": "Prospecção",
    "Engaging": "Em negociação",
    "Won": "Ganho",
    "Lost": "Perdido",
    "PENDING": "Pendente",
    "COMPLETED": "Concluída",
    "HISTORICAL": "Histórico",
    "Encerrada": "Encerrada",
}


def label(code):
    return LABELS.get(code, code)


def labels(codes):
    return [label(code) for code in codes]

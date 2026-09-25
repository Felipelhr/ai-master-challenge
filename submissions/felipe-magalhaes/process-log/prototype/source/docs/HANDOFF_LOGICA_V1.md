# Handoff — Challenge 003 Lead Priority Engine V1

## Estado
A investigação ampla foi encerrada. O objetivo agora é construir a V1 funcional.

## Dataset oficial
Usar:
- accounts.csv
- metadata.csv
- products.csv
- sales_pipeline.csv
- sales_teams.csv

Normalização obrigatória:
- `GTXPro` -> `GTX Pro`

Metadata:
- `accounts.revenue` está em milhões de USD.
- `engage_date` representa entrada em `Engaging`.

## Snapshot da demo
`as_of_date = 2017-12-31`

Oportunidades abertas:
- 500 Prospecting
- 1.589 Engaging

## Lógica validada pela Sam

### Método D — principal
Para Engaging de 0–138 dias com conta conhecida:
- regressão logística L2;
- target: ganhar nos próximos 30 dias;
- features: idade em dias, faixa de idade, produto, setor, receita anual da empresa, funcionários, idade da empresa no cutoff, subsidiária ou não.

Não usar: close_date, close_value, resultado final, dados futuros, nome da conta, vendedor, manager, região como peso preditivo, ausência da conta como penalidade.

`priority_value = propensity_30d * sales_price`

### Fallback — conta ausente
Para Engaging de 0–138 dias sem conta:
`p_faixa = (wins_30d_faixa + 20 * taxa_global) / (observacoes_faixa + 20)`

Faixas propostas:
- 0–15
- 16–45
- 46–90
- 91–120
- 121–138

`priority_value = p_faixa * sales_price`

### Priority Score
Para oportunidades cobertas:
- converter `priority_value` em posição relativa 0–100;
- não é probabilidade de fechamento.

### Engaging >138 dias
Todos recebem Priority Score operacional, mas sem propensity inventada.
- base: potencial econômico relativo dentro da fila de revalidação;
- `Score Basis = OUT_OF_COVERAGE_VALUE`;
- `Confidence = LOW`;
- tags: `OUT_OF_COVERAGE_AGE`, `ACTION_LAST_CONTACT_BEFORE_FREEZE`

### Prospecting
Todos recebem Priority Score operacional baseado em potencial econômico relativo.
- `Score Basis = PROSPECTING_VALUE`;
- `Confidence = LOW`;
- tags: `PROSPECTING_NO_ENGAGE_DATE`, `ACTION_QUALIFY_PROSPECTING`

## Action Tags
- ACTION_WORK_NOW
- ACTION_ENRICH_ACCOUNT
- ACTION_LAST_CONTACT_BEFORE_FREEZE
- ACTION_QUALIFY_PROSPECTING

## Auxiliary Tags
- ACCOUNT_MISSING
- MODEL_FULL
- AGE_ONLY_FALLBACK
- OUT_OF_COVERAGE_AGE
- PROSPECTING_NO_ENGAGE_DATE
- LOW_SUPPORT_AGE_121_138
- TOP_5_SELLER
- FOLLOWUP_AUTOMATIZADO

`FOLLOWUP_AUTOMATIZADO` é regra operacional, não conclusão estatística.
Regra inicial:
- Engaging
- <=138 dias
- conta conhecida
- TOP_5_SELLER

## Campos obrigatórios por oportunidade
- Priority Score
- Score Basis
- Confidence
- Action Tag
- Auxiliary Tags
- Reason
- Next Action
- propensity_30d somente quando legítimo
- priority_value quando aplicável

## Resultados finais reportados pela Sam
Top 5 por vendedor, seis cortes temporais:
- A preço puro: 165 wins; US$ 969.188; 24,8% da receita; retenção 86,1%
- B idade × preço: 179 wins; US$ 1.021.014; 26,1%; retenção 52,8%
- C P(win 30d | idade) × preço: 216 wins; US$ 1.169.680; 29,9%; retenção 45,1%
- D regressão logística/fallback × preço: 255 wins; US$ 1.347.335; 34,5%; retenção 57,1%

AUC média:
- C: 0,622
- D: 0,658

D sobre C:
- +US$ 177.655
- ~+15,2% em receita capturada

D sobre preço puro:
- ~+39% em receita capturada

Interpretação:
- há sinal adicional moderado;
- não alegar alta precisão;
- não buscar modelo mais sofisticado.

## Cobertura no snapshot final
Engaging 0–138 dias:
- 298 recebem score temporal
  - 89 conta conhecida -> MODEL_FULL
  - 209 conta ausente -> AGE_ONLY_FALLBACK

Engaging >138 dias:
- 1.291 -> OUT_OF_COVERAGE_VALUE + fila de revalidação

Prospecting:
- 500 -> PROSPECTING_VALUE + fila de qualificação

## Evidência independente
`ol-x20.zip` contém auditoria independente do Astra:
- relatório;
- script reproduzível;
- outputs/resultados;
- teste forward-30;
- revisão metodológica.

Usar como auditoria/contraprova, não como substituto automático da lógica final da Sam.

## Artefatos da Sam não incluídos
Os arquivos reais citados pela Sam:
- `docs/v1_logic_spec.md`
- `analysis/05_temporal_benchmark.py`
- outputs do benchmark

não foram exportados para esta conversa.
Este handoff registra os resultados finais reportados pela Sam.
Se os artefatos originais forem disponibilizados depois, prefira-os para reproduzir exatamente o treinamento/benchmark.

## Produto
Construir um sistema de priorização comercial explicável, não um "oráculo de fechamento".

Todos os deals abertos recebem Priority Score.
Score, confiança, ação e explicação são dimensões separadas.

Filtros + `Baixar CSV visível` são requisitos.
Adicionar formulário de nova oportunidade que aplica o modelo congelado sem retreinar.

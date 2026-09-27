# Novo benchmark retrospectivo reproduzível

Este experimento foi construído na rodada posterior aos feedbacks da entrega `b63d22e`. **Não é reprodução do benchmark antigo**: os scripts originais não estavam na submissão nem foram localizados nos projetos locais examinados. Não se tenta recuperar os números antigos por ajuste de parâmetros.

## Protocolo definido

- Dataset e joins do construtor existente. Universo por corte: negociações iniciadas, ainda abertas naquela data e com 0–138 dias; inclui conta conhecida e ausente.
- Avaliações: 30/06, 31/07, 31/08, 30/09, 31/10 e 30/11 de 2017, com alvo de vitória nos 30 dias seguintes e observação até 31/12/2017.
- Em cada avaliação, refaz pré-processamento, regressão e fallback usando apenas cortes anteriores desde março cuja janela inteira de 30 dias já terminou. Nenhum artefato ajustado com dados posteriores é reutilizado para avaliar o passado.
- Regressão L2 com as mesmas oito features do modelo; fallback suavizado por faixa, parâmetro 20, aprendido somente no treino daquele corte. Firmografia continua sendo o snapshot disponível, limitação não resolvida.
- A = preço; B = idade em dias multiplicada pelo preço; C = taxa suavizada da faixa multiplicada pelo preço; D = modelo para conta conhecida e fallback para ausente, multiplicados pelo preço.
- Todos usam o mesmo universo, percentil inteiro arredondado, desempate por preço e ID, e até cinco oportunidades por vendedor. AUC usa propensão antes de multiplicar por preço, não o Score.
- Seis cortes × 30 vendedores × cinco posições = 900 decisões por método. Uma oportunidade pode ser selecionada em vários cortes; decisões não são observações independentes.
- Receita é `close_value` dos ganhos observados na janela, usado **somente para avaliar**. Não entra em features ou ordenação.
- As janelas de avaliação não se sobrepõem neste protocolo. Os ganhos únicos e sua receita também são emitidos no JSON; aqui coincidem com os totais, mas oportunidades selecionadas se repetem.

## Resultados executados

| Método | Decisões | Ganhos selecionados | Valor histórico dos ganhos (USD) | AUC média dos cortes |
| --- | ---: | ---: | ---: | ---: |
| A — preço | 900 | 165 | 969.188 | — |
| B — idade × preço | 900 | 137 | 747.394 | — |
| C — propensão por faixa × preço | 900 | 172 | 951.180 | 0,542 |
| D — modelo/fallback × preço | 900 | 198 | 1.077.539 | 0,541 |

D selecionou mais ganhos e valor histórico que A neste experimento. **AUC 0,541 é próxima de 0,5 e indica discriminação global fraca**; não sustenta chamar a propensão de amplamente confiável ou calibrada. O resultado de seleção não comprova aumento causal de receita, desempenho futuro ou superioridade estatisticamente estabelecida. Não se escolheu outro protocolo para recuperar a AUC antiga de 0,658.

Apenas negociações com suporte temporal são avaliadas. Nada neste resultado valida comparação com Qualificação/Revalidação ou divisão do tempo entre filas. O componente preditivo permanece experimental.

### Estabilidade nos seis cortes

Comparação direta do preço simples (A) com modelo/fallback × preço (D), extraída dos [resultados por corte](../solution/scripts/scoring/benchmark-results/summary.json). Cada método seleciona 150 oportunidades por corte. Os valores são o valor histórico dos ganhos selecionados nos 30 dias seguintes, em USD; a AUC de D avalia a propensão em todo o universo elegível daquele corte.

| Corte | Ganhos A | Ganhos D | Valor A (USD) | Valor D (USD) | AUC D |
| --- | ---: | ---: | ---: | ---: | ---: |
| 30/06/2017 | 11 | 5 | 53.644 | 24.377 | 0,453 |
| 31/07/2017 | 30 | 37 | 204.780 | 240.045 | 0,601 |
| 31/08/2017 | 38 | 69 | 220.941 | 351.412 | 0,748 |
| 30/09/2017 | 7 | 2 | 39.619 | 10.756 | 0,388 |
| 31/10/2017 | 26 | 24 | 160.581 | 139.376 | 0,441 |
| 30/11/2017 | 53 | 61 | 289.623 | 311.573 | 0,612 |
| **Total / AUC média** | **165** | **198** | **969.188** | **1.077.539** | **0,541** |

D supera A em ganhos selecionados e valor histórico em julho, agosto e novembro; fica abaixo em junho, setembro e outubro. **A vantagem agregada não é consistente entre os cortes**: em três dos seis, a AUC de D também fica abaixo de 0,5. Este detalhamento não altera o protocolo nem acrescenta evidência de significância estatística ou ganho causal.

## Reprodução e arquivos

A partir de `solution/`, com Python 3.12 e dependências de `scripts/scoring/requirements.txt`:

```bash
python scripts/scoring/temporal-benchmark.py --check
```

- [Script completo](../solution/scripts/scoring/temporal-benchmark.py)
- [Resultados agregados e por corte](../solution/scripts/scoring/benchmark-results/summary.json)
- [Cada oportunidade selecionada, vendedor, posição e desfecho](../solution/scripts/scoring/benchmark-results/selections.csv)
- [Dependências](../solution/scripts/scoring/requirements.txt)

Sem `--check`, o script regenera esses dois arquivos. Com `--check`, repete o experimento e confere métricas, Scores e IDs com tolerâncias numéricas explícitas. Há guardas para maturidade dos rótulos, janela completa, máximo de cinco por vendedor e isolamento dos desfechos futuros. O hash dos CSVs é insensível a LF/CRLF; o hash do artefato usa representação JSON canônica. O artefato da aplicação não é regravado.

## Limitações remanescentes

Firmografia sem versões históricas pode vazar informação retrospectiva. O limite de 138 dias e as features foram escolhidos após conhecer o dataset original; este backtest não é um teste prospectivo intocado. Existem oportunidades repetidas entre treinos e decisões, sem intervalo de confiança ou alegação de independência. Não há custo, margem, esforço por contato ou efeito do tratamento comercial. AUC não mede qualidade de calibração; Brier por corte está no JSON, sem reivindicação de calibração comprovada.

A coleta de dados atuais e a validação prospectiva continuam necessárias antes de promover o modelo como recomendação de produção.

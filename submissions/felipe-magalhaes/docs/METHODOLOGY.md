# Metodologia — G4 Lead Scorer

## Escopo, fonte e proveniência

Esta nota descreve a lógica histórica preservada e a correção posterior de filas executada em [`../solution/`](../solution/) a partir do produto originalmente congelado (`7f3d349`) e publicado em `b63d22e`. A atualização mantém coeficientes, propensões, referências e percentis internos; altera sua utilização operacional. As fontes diretas são os cinco CSVs em `solution/data/`, o construtor [`build-model-artifact.py`](../solution/scripts/scoring/build-model-artifact.py), o artefato [`model-artifact.json`](../solution/src/domain/scoring/model-artifact.json), o motor [`engine.ts`](../solution/src/domain/scoring/engine.ts), a fixture legada e os scripts de verificação. O benchmark A/B/C/D é **reportado no handoff da análise anterior**, citado no inventário de fontes; seus scripts e outputs originais não foram disponibilizados nesta entrega. A paridade com o protótipo foi verificada separadamente e não reproduz aquele benchmark.

## Dados e joins

O arquivo `sales_pipeline.csv` tem 8.800 linhas e `opportunity_id` como identificador. O código normaliza `GTXPro` para `GTX Pro` **em memória** e associa:

1. `products.csv` por produto, obtendo `sales_price` e série;
2. `accounts.csv` por nome da conta, obtendo setor, receita, funcionários, ano de fundação, controladora e localização;
3. `sales_teams.csv` por vendedor, obtendo gestor e região.

Produto e vendedor sem correspondência são erros; conta ausente permanece uma situação válida, sem firmografia inventada. O script de construção do artefato exige cardinalidade preservada e preço/gestor presentes. `accounts.revenue` representa **receita anual em milhões de USD** conforme `metadata.csv`; `sales_price` é preço sugerido do produto e `close_value` é valor do negócio encerrado. Para oportunidades abertas e perdidas, a interface exibe o preço sugerido; para ganhas, o valor de fechamento. O scorer usa `salesPrice` para formar a dimensão econômica, não `close_value`.

O snapshot operacional é **31/12/2017**: 500 Prospecting, 1.589 Engaging, 4.238 Won e 2.473 Lost. As 2.089 abertas recebem resultado interno de inteligência; apenas as 298 de Venda ativa exibem Score temporal. A distribuição das bases é 89 `MODEL_FULL`, 209 `AGE_ONLY_FALLBACK`, 1.291 `OUT_OF_COVERAGE_VALUE` e 500 `PROSPECTING_VALUE`.

## Corte temporal, alvo e controle de vazamento

O treinamento cria **nove cortes mensais** de **31/03/2017 a 30/11/2017**, cada qual com janela futura completa de 30 dias, totalizando **10.589 linhas de treino**. Em cada corte entram oportunidades com conta identificada, já em Engaging, idade em negociação entre 0 e 138 dias e ainda não encerradas naquele corte. O alvo vale 1 se a oportunidade ganha nos **30 dias seguintes** ao corte. `close_date` e o resultado final são utilizados para construir elegibilidade/rótulo, não como variáveis de entrada do modelo. `close_value`, vendedor, gestor, região e nome da conta também não entram nas variáveis preditivas.

O limite de 138 dias é o horizonte observado usado pelo modelo, não um prazo causal para perder ou congelar um negócio. `engage_date` é a entrada em Engaging. Prospecting não tem essa data e, portanto, não tem idade em negociação para inferência temporal. O formulário de novas oportunidades restringe a data em negociação ao snapshot do artefato, evitando datas futuras incompatíveis com a referência histórica.

**Risco residual:** as características das empresas provêm de um snapshot cadastral, não de versões datadas em cada corte. Receita, funcionários e setor podem refletir informação posterior ao corte histórico. O controle acima impede uso direto do desfecho como feature, mas **não elimina esse possível vazamento retrospectivo**. Cortes mensais também repetem oportunidades; suas linhas não são observações independentes. Sem scripts originais do benchmark e sem histórico cadastral point-in-time, não se reivindica validação prospectiva ou calibração atual.

## Hipóteses A/B/C/D e escolha histórica

Os números a seguir são **registro histórico não reproduzido**, não evidência atual de desempenho. O [novo benchmark reproduzível](BENCHMARK_REPRODUCIBLE.md) tem protocolo explícito, resultados distintos e AUC inferior à antiga reportada. O handoff anterior compara Top 5 por vendedor em seis cortes:

| Método | Hipótese | Ganhos reportados | Receita reportada |
| --- | --- | ---: | ---: |
| A | Preço puro | 165 | US$ 969.188 |
| B | Idade em negociação × preço | 179 | US$ 1.021.014 |
| C | Propensão por faixa de idade × preço | 216 | US$ 1.169.680 |
| D | Regressão logística e fallback × preço | 255 | US$ 1.347.335 |

O mesmo handoff reporta AUC média 0,622 para C e 0,658 para D. D foi escolhida como lógica principal **somente no subconjunto com suporte temporal**: usa sinais de tempo, produto e conta quando disponíveis; fallback temporal quando falta conta. A foi insuficiente como regra única porque preço sozinho não representa timing; B converte antiguidade em peso sem estabelecer que um negócio antigo é pior; C não usa todos os atributos disponíveis. A comparação reportada sugere ganho moderado, não alta precisão. Os números acima não foram reexecutados nesta entrega e não devem ser atribuídos ao script de verificação de paridade.

## Modelo completo: `MODEL_FULL`

Para Engaging com conta identificada e **0–138 dias**, o pipeline aplica regressão logística L2. Variáveis numéricas: dias em negociação, receita da empresa, funcionários e idade da empresa no corte. Variáveis categóricas: faixa de idade, produto, setor e indicador de subsidiária. Valores numéricos ausentes são imputados pela mediana de treino, padronizados e combinados com categorias codificadas; categorias não vistas não recebem coeficiente próprio. O artefato congela imputações, escalas, categorias, coeficientes e intercepto. A saída `propensity30d` é estimativa histórica de vitória nos próximos 30 dias para oportunidades semelhantes, **não garantia de fechamento**.

As faixas de idade são **0–15, 16–45, 46–90, 91–120 e 121–138 dias**. Entre 121 e 138 dias o motor adiciona o sinal `LOW_SUPPORT_AGE_121_138`. A qualidade exibida para `MODEL_FULL` é **Maior** (`MEDIUM` interno), o que descreve suporte informacional, não certeza estatística.

## Conta ausente: `AGE_ONLY_FALLBACK`

Para Engaging coberto sem conta identificada, o sistema não cria setor, receita ou empregados fictícios. Usa a taxa histórica suavizada da faixa de tempo:

```text
p_faixa = (ganhos_30d_na_faixa + 20 × taxa_global) / (observações_na_faixa + 20)
```

O parâmetro de suavização **20** reduz a influência de faixas com menos observações. O produto participa da prioridade econômica, mas a falta da conta **não reduz diretamente a propensão nem o Score como penalidade**. A análise recebe evidência **Menor** (`LOW`) e ação de enriquecer a conta. `ACCOUNT_MISSING` e `AGE_ONLY_FALLBACK` são sinais de explicação, não um julgamento de qualidade do negócio.

## Valor de prioridade, Score relativo e três filas operacionais

Em `MODEL_FULL` e `AGE_ONLY_FALLBACK`:

```text
priorityValue = propensity30d × salesPrice
```

O `priorityValue` é usado para posicionar o negócio na **distribuição congelada dos 298 valores cobertos**; não é receita prevista da carteira. O Score inteiro de 0–100 é posição relativa dessa distribuição. Empates usam posição central na referência, com ajuste para os negócios que pertencem ao snapshot congelado, e arredondamento determinístico. O motor não retreina quando filtros ou novos negócios mudam o universo visualizado.

Acima de 138 dias em Engaging, `OUT_OF_COVERAGE_VALUE` usa **percentil do preço sugerido na referência congelada da fila de revalidação**, sem `propensity30d` e sem `priorityValue`. A ação é fazer contato de revalidação antes de considerar congelamento. Em Prospecting, `PROSPECTING_VALUE` usa **percentil do preço sugerido na referência da fila de qualificação**, também sem propensão temporal, com ação de qualificar necessidade, contato e prazo. Esses percentis econômicos continuam no resultado interno para manter compatibilidade histórica, mas **não são exibidos como Score nem comparados à fila temporal**. A UI mostra valor, finalidade e posição local. Apenas 298/2.089 têm estimativa temporal. Quatro bases de cálculo correspondem a três filas: modelo e fallback compartilham Venda ativa; as outras são Revalidação e Qualificação.

Novas oportunidades usam a referência congelada em modo `reference`; os negócios do snapshot histórico usam modo `snapshot`. A simulação e o cadastro de uma mesma oportunidade nova chamam a mesma regra `reference`, preservando Score, base, evidência, ação e sinais. O motor devolve `null` para Won/Lost: não há Score operacional atual para negócios encerrados.

## Ordenação, Tier, evidência e ação

O ranking filtra oportunidades abertas e separa as filas **antes** de selecionar até cinco itens em cada uma. Venda ativa aplica **Score DESC → Valor exibido DESC → ID**; Revalidação e Qualificação aplicam **Valor exibido DESC → ID**. Lista e Kanban mantêm cabeçalhos explícitos por grupo, inclusive na ordenação manual. O Top 5 é uma consulta dinâmica por fila, não tag. A ordem visual dos grupos não aloca tempo nem estabelece precedência comercial entre eles. Os filtros numéricos de Score e as métricas agregadas desse Score são exclusivos de Venda ativa. A consulta é compartilhada por Prioridades, Tarefas, Dashboard e digest. Modelo e fallback estimam o mesmo alvo e compartilham referência, mas sua calibração comparativa não é presumida.

Lead Tier é uma heurística comercial descritiva A+–E, com pesos de julgamento e sem validação preditiva própria: 50% percentil fixo do preço sugerido, 25% receita, 10% funcionários e 15% completude cadastral de seis campos (conta, setor, ano de fundação, receita, funcionários e localização). Receita e funcionários ausentes recebem referência neutra 0,50; sua ausência também afeta a completude. Controladora não é campo obrigatório de completude. Tier não altera Score, não é probabilidade e não define sozinho Top 5. Suas referências congeladas derivam do dataset e permanecem fixas com filtros e novas oportunidades.

Qualidade da Evidência traduz os códigos internos `MEDIUM`/`LOW` em **Maior/Menor**. Maior acompanha modelo completo; Menor acompanha fallback, fora da cobertura e prospecção. Ela mede suporte informacional, não potencial comercial ou chance de fechar. Ação Recomendada é uma orientação condicional à base: trabalhar agora, enriquecer a conta, revalidar por contato, sem presumir perda ou qualificar. Motivo, limitação e próxima ação ficam disponíveis no detalhe.

## Artefato e verificações

[`build-model-artifact.py`](../solution/scripts/scoring/build-model-artifact.py) constrói o artefato a partir dos CSVs, congela o pré-processamento, coeficientes, fallback e referências, e registra hash dos dados e versões das bibliotecas de treinamento. As versões Python estão fixadas em [`requirements.txt`](../solution/scripts/scoring/requirements.txt). A aplicação Next.js **não executa Python em tempo de uso**: [`engine.ts`](../solution/src/domain/scoring/engine.ts) faz inferência em TypeScript a partir do JSON versionado.

[`verify-scoring.ts`](../solution/scripts/scoring/verify-scoring.ts) verifica o hash dos dados, as oito variáveis, as contagens das quatro bases, a ausência de Score nos encerrados e a paridade com a [fixture legada](../solution/scripts/scoring/fixtures/legacy-snapshot.json) para 2.089 abertos e quatro casos novos. Compara Score, base, evidência, ação e sinais exatamente, além de limites numéricos para propensão e `priorityValue`. A fixture foi exportada do protótipo funcional e identifica hashes do motor/modelo de origem. **Essa verificação prova compatibilidade de implementação com a referência exportada, não desempenho preditivo futuro.**

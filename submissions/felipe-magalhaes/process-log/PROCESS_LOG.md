# Process Log — Challenge 003 / G4 Lead Scorer

**Responsável:** Felipe de Magalhães Alves.

**Entrega principal:** [`../solution/`](../solution/), produto congelado no commit `7f3d349`.

**Fontes deste relato:** [registros originais](raw/), [histórico bruto de commits](COMMIT_HISTORY_RAW.md), [inventário](../docs/INVENTORY_RAW.md), código e scripts da solução e decisões registradas no pedido de documentação. Datas dos commits são evidência de sequência, **não medição de horas trabalhadas**.

## Papéis humanos e ferramentas

**100% do código foi gerado por IA; Felipe não escreveu manualmente nenhuma linha de código.** Felipe definiu o problema, as hipóteses, os critérios, a lógica comercial, a arquitetura, a UX e as decisões finais, dirigindo a implementação e a revisão.

| Ferramenta | Papel registrado |
| --- | --- |
| Sam Agent | Análise/modelagem inicial e contexto do benchmark histórico. |
| Claude | Challenger e exploração de hipóteses alternativas. |
| Astra | Auditoria independente, reprodução de casos operacionais e crítica. |
| ChatGPT | Síntese, cross-audit, decisões metodológicas e arquitetura de produto. |
| Codex | Implementação do código, testes, correções e organização da entrega. |

O budget oficial do Challenge é **4–6 horas**. **Aproximadamente 6 horas de trabalho efetivo, distribuídas em sessões e excluindo pausas e períodos sem execução.** Essa é uma estimativa de tempo útil alinhada ao budget, não uma cronometragem contínua nem o intervalo de calendário entre os commits.

## 1. Problema e exploração

O ponto de partida foi decidir quais oportunidades comerciais mereciam atenção imediata em uma carteira de milhares de negócios. A prioridade precisava ser inteligível para um vendedor e auditável: **Score**, potencial comercial, suporte da evidência e próximo passo não deveriam ser o mesmo número. Os cinco CSVs mostram pipeline, produtos, contas, equipe e metadados. A ingestão final confirma **8.800 negócios**, dos quais **2.089 abertos** no snapshot de 31/12/2017.

A exploração distinguiu **wins absolutos de taxa de conversão** e **receita total de propensão**. Mais vitórias em um grupo podem refletir mais negócios, não uma chance maior por oportunidade. Receita fechada pode refletir ticket ou volume e não informa, por si, a chance condicional de vitória nos próximos 30 dias. Um negócio antigo aberto tampouco pode ser tratado como fracasso observado: considerar somente os encerrados introduz **survivor bias**. A ausência de conta não deveria ser lida como prova de lead pior. Esses limites orientaram o desenho do score e a explicação ao usuário.

## 2. Hipóteses, benchmark e decisão metodológica

O handoff da investigação anterior registra quatro alternativas: **A, preço puro**; **B, idade × preço**; **C, propensão por faixa de idade × preço**; **D, regressão logística com fallback temporal × preço**. O benchmark reportado de seis cortes e Top 5 por vendedor apontou, respectivamente, **165 / 179 / 216 / 255 ganhos** e **US$ 969.188 / 1.021.014 / 1.169.680 / 1.347.335** de receita capturada. AUC média reportada: 0,622 em C e 0,658 em D. Os scripts e outputs originais da Sam não foram disponibilizados nesta entrega; esses valores são **resultados reportados**, não reexecutados pelo código final. [Metodologia](../docs/METHODOLOGY.md) registra a proveniência e os limites.

A decisão foi usar D **onde havia suporte histórico**: Engaging de 0–138 dias, com modelo completo para conta identificada e fallback suavizado por faixa de tempo para conta ausente. A descartou informação de timing e perfil; B corria o risco de transformar antiguidade em julgamento automático; C era menos contextual quando atributos de conta e produto estavam disponíveis. D preservou o valor econômico via `propensity30d × salesPrice`, mas **Score não virou probabilidade**. A distinção entre prioridade e chance de ganho permaneceu explícita no produto.

O ponto decisivo foi **não inventar propensão onde faltava suporte**. Entre 2.089 abertos, 89 usam modelo completo, 209 fallback temporal, 1.291 estão além dos 138 dias e 500 estão em Prospecting sem `engage_date`. Os dois últimos grupos recebem filas econômicas relativas e ações de revalidação/qualificação, não previsão temporal. Contas ausentes recebem evidência Menor e ação de enriquecimento, sem penalidade automática por missingness. O limite temporal não é uma regra causal de perda.

Também houve atenção a **leakage**: desfecho, `close_date` e `close_value` não entram como features; cortes mensais só usam oportunidades ativas e janela de rótulo de 30 dias. Ainda resta risco porque a firmografia disponível é snapshot do dataset, não valores versionados no instante de cada corte. Essa restrição não foi ocultada em favor de uma métrica mais atraente.

## 3. Protótipo funcional de validação

O projeto irmão `G4-003` antecedeu a solução Next.js. Foi usado como caso de estudo e ferramenta para testar hipóteses de scoring, explicabilidade e UX, com aplicação Python/Streamlit, artefato e testes. **O protótipo foi tratado como ferramenta de pensamento, não como entrega final.** Seu [código está incluído como evidência opcional do processo](prototype/source/), claramente separado da solução oficial em [`../solution/`](../solution/).

O motor da aplicação final foi portado para TypeScript com artefato congelado. Uma fixture exportada do protótipo foi usada para conferir **2.089/2.089** oportunidades abertas e quatro casos novos. A paridade valida a implementação contra aquela referência; **não reconstrói** o benchmark original da Sam nem elimina os riscos estatísticos acima.

## 4. Construção da solução final — sequência verificável

O [histórico bruto](COMMIT_HISTORY_RAW.md) registra hash, timestamp e mensagem sem interpretação. A sequência a seguir usa esses commits e os Process Logs dos blocos como marcos; ela não atribui duração exata a nenhuma etapa.

| Marco | Evidência | Decisão e resultado |
| --- | --- | --- |
| Fundação, 24/09 | `03f6ebb` | Pipeline CSV, Lista/Kanban e workspace compartilhado. |
| Motor, 24/09 | `0bafc1d` | Artefato validado portado para TypeScript; Score, base, evidência, ação e explicação visíveis. |
| Operação, 24/09 | `48c5142`; `PROCESS_LOG_BLOCO_3.md` | SQLite local para novas oportunidades, tarefas, tags, notas e etapas sem credenciais; CSVs preservados como histórico. Felipe definiu regras e aceite, IA implementou. |
| Prioridades, 25/09 | `475638c`; `PROCESS_LOG_BLOCO_4.md` | Lead Tier separado do Score; Top 5 como consulta dinâmica, sem tag persistida. |
| Gestão e e-mail, 25/09 | `a0f69ce`; `PROCESS_LOG_BLOCO_5.md` | Dashboard e digest sobre o ranking aprovado; envio manual/agendado com worker separado, log e idempotência local. |
| Uso do produto, 25/09 | `6703317`; `PROCESS_LOG_BLOCO_5_5.md` | Felipe pediu ordem inicial por Score, desempate econômico, Kanban coerente, rolagem, colunas, separação Status/Etapa, funis e workspace mais operacional. |
| Ajustes dirigidos | `ad66448`, `e3de617`, `b352625` | Barra horizontal e adição rápida de etapa; Top 5 alinhado ao desempate por Valor; branding G4 Lead Scorer e página explicativa. |
| Auditoria e correções | `26b365e` | Quatro findings operacionais reproduzidos pela Astra e corrigidos sem mudar o artefato histórico. |
| Fechamento do produto | `b9fcd5b`, `7f3d349` | Finalização visível para ganhos/perdidos no Kanban; página Como funciona alinhada às quatro bases, Tier, evidência e limites. |

O Top 5, a Lista e o Kanban usam **Score DESC → Valor exibido DESC → ID**. A preferência comercial de Felipe foi decidir **onde agir** antes do ticket; um negócio de Score 99/500k aparece depois de Score 100/80k e Score 100/20k. O valor não desaparece: participa da dimensão econômica da base aplicável e desempata prioridades iguais.

## 5. Onde a IA errou e como corrigimos

A auditoria Astra classificou o produto como apto após ajustes menores, mas reproduziu quatro falhas operacionais concretas:

1. **Ordenação manual por Score:** o desempate manual ia diretamente ao ID. Passou a usar Valor DESC e só então ID, tanto em Score DESC como em Score ASC.
2. **Funil e filtro de funil:** estados separados podiam selecionar universos diferentes e esvaziar visualmente o Kanban. A seleção e o filtro passaram a usar o mesmo universo para contador e cards.
3. **Simulação versus cadastro:** os mesmos inputs podiam render Score 29 na simulação e 30 após salvar por modos de referência diferentes. A regra de oportunidade nova foi centralizada, com igualdade de Score, base, evidência, ação e sinais antes/depois do cadastro.
4. **Reabertura de negócio:** Score era recalculado, mas tags SYSTEM e tarefa inicial podiam ficar incoerentes. A reabertura passou a sincronizar sinais e inicialização idempotente, sem apagar tarefas USER nem duplicar tarefas/tags.

Após esses ajustes, o uso do Kanban revelou outro problema de percepção: selecionar Ganho ou Perdido parecia fazer negócios sumirem do pipeline. A coluna fixa **Finalização** passou a apresentar encerrados, mantendo Prospecção e Em negociação visíveis; o filtro por Status define quais cards aparecem. Essa foi uma decisão de modelagem operacional e UX, não alteração do scoring histórico.

As correções foram acompanhadas por scripts de domínio e verificações específicas; a paridade histórica **2.089/2.089** permaneceu como restrição. O registro não afirma validação de envio real Resend em produção nem ganho prospectivo de receita.

## 6. Entrega, evidências e limites

A solução final contém o código, os cinco CSVs, artefato, referências do Tier, fixture, scripts, dependências e configuração de exemplo. O produto usa SQLite local, sem autenticação ou multiempresa real. O Dashboard e o digest compartilham o ranking dinâmico do Top 5. A [documentação metodológica](../docs/METHODOLOGY.md), as [limitações](../docs/LIMITATIONS.md) e o [caminho possível para produção](../docs/PRODUCTION_PATH.md) distinguem implementação presente de evolução futura.

Evidências disponíveis: [commits](COMMIT_HISTORY_RAW.md), [Process Logs originais](raw/), [screenshots](screenshots/), scripts de verificação e fixture dentro de `solution/`. Gravação de tela e exports não foram incluídos nesta rodada. Nenhuma publicação, push ou PR é parte deste registro.

### Evidências visuais

As capturas abaixo registram conversas de exploração, decisões de Felipe e telas do produto. A sequência agrupa as evidências pela evolução lógica do trabalho.

1. [Lógica inicial e cuidados](screenshots/Logica-Inicial-E-Cuidados.jpeg) — Felipe pede análise dos negócios encerrados e alerta para a diferença entre volume de ganhos e taxa de conversão por segmento.
2. [Discordância sobre a lógica de atividade](screenshots/Discordância-Logica-Atividade.jpeg) — Felipe contesta deixar negócios sem Score e pede explicação e ação para oportunidades com dados incompletos.
3. [Construção da lógica](screenshots/Construção-de-Lógica.jpeg) — Felipe prioriza corrigir o primeiro benchmark antes de avançar; a conversa organiza validação, QA e documentação.
4. [Correção do protótipo antigo](screenshots/Correção-Protótipo-Antigo.jpeg) — Felipe pede que a Lista mostre prioridade, motivo e próximo passo diretamente para o vendedor.
5. [Insights e edições](screenshots/Insights-e-Edições.jpeg) — Felipe detalha ajustes de filtros e exportação CSV no protótipo, sem pedir integração externa naquela etapa.
6. [Criação de novas lógicas](screenshots/Criação-novas-logicas-durante-projeto.jpeg) — Felipe propõe o Lead Tier e discute sua separação do Score e da qualidade da evidência.
7. [Correção de nomenclaturas](screenshots/Correção-nomenclaturas.jpeg) — Felipe questiona os rótulos de confiança e propõe Qualidade da Evidência, com níveis Menor e Maior.
8. [Alterações para o layout](screenshots/Alteraçoes-Para-Layout.jpeg) — No uso da Mini-Arena, Felipe aponta ajustes na Lista, na separação entre Status e Etapa, nos filtros, nos funis e no workspace.
9. [Resolução de problemas encontrados](screenshots/Resolução-Problemas-Encontrados.jpeg) — Felipe relata inconsistências visuais ao filtrar Ganho/Perdido/Aberto e pede que a documentação evidencie melhor seu julgamento na lógica do projeto.
10. [Sugestão de exibir o protótipo inicial](screenshots/Sugestão-exibir-prototipo-inicial.jpeg) — Felipe propõe incluir o protótipo como evidência do processo, deixando explícito que a solução final é outra.
11. [Tela da Lista](screenshots/Print-Tela-Lista.jpeg) — A captura mostra a carteira aberta com Score, Tier, ação recomendada, motivo de prioridade, tarefa e ordenação padrão visíveis.
12. [Tela do Kanban](screenshots/Print-Tela-Kanban.jpeg) — A captura mostra Prospecção, Em negociação, Finalização e a ação de adicionar etapa no pipeline filtrado por Status Aberto.

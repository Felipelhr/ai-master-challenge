# Limitações e condições de uso

Esta lista distingue o que a solução local em [`../solution/`](../solution/) verifica do que ainda exigiria dados, avaliação ou infraestrutura adicionais. Ela não altera a lógica congelada do produto.

## Dados

- **Firmografia como snapshot:** receita, funcionários, setor e demais atributos de conta não têm versões datadas em cada corte. Parte da informação pode ter sido atualizada depois da oportunidade; isso cria risco de vazamento retrospectivo mesmo sem usar o desfecho como variável preditiva.
- **Sem margem ou custo:** `sales_price` é preço sugerido. O `priorityValue` ponderado por propensão e o valor exibido não representam lucro, contribuição ou receita futura garantida. `close_value` existe para negócios ganhos, mas não é informação disponível para precificar um negócio aberto no momento da decisão.
- **Sem histórico completo de atividades:** os CSVs não descrevem todas as tentativas de contato, respostas, mudanças de etapa ou cadência comercial. O modelo não observa esses sinais e a ação recomendada precisa ser contextualizada pelo vendedor.
- **Contas ausentes:** parte dos negócios em Engaging não identifica uma conta com firmografia. Eles recebem fallback temporal e evidência Menor; a ausência não é penalidade preditiva automática.
- **Prospecting sem `engage_date`:** ainda não há idade em negociação. Sua fila é econômica/operacional, sem propensão temporal.

## Estatística e metodologia

- **Cobertura observada até 138 dias:** além desse horizonte o modelo não extrapola uma propensão de 30 dias. O corte é limite de suporte histórico, não regra causal de perda. Na carteira aberta, 1.291 Engaging estão fora da cobertura e 500 Prospecting não têm tempo em negociação; só 298 de 2.089 abertos recebem estimativa temporal.
- **Score não é probabilidade:** é posição relativa de prioridade de 0 a 100 em distribuições de referência congeladas. Os percentis econômicos legados permanecem internos e não entram em um ranking global. O Score exibido, seus filtros e sua média são restritos à Venda ativa. Qualificação e Revalidação mostram ordem por valor. A divisão de atenção entre filas não foi validada e fica com o usuário. O Score não é previsão de receita nem decisão automática de encerramento.
- **Lead Tier não é probabilidade:** é classificação descritiva de potencial/completude com referência fixa. Não altera o Score nem define sozinho o Top 5.
- **Amostras temporais repetidas:** um negócio pode aparecer em mais de um corte mensal de treino. As linhas não são independentes; a documentação não atribui precisão estatística a uma contagem simples de linhas.
- **Benchmark A/B/C/D legado reportado, não reexecutado:** o handoff anterior contém os resultados e seis cortes, mas os scripts e outputs originais não acompanham esta solução. A fixture legada testa compatibilidade da implementação, não reproduz o benchmark da Sam nem prova calibração ou retorno financeiro futuro. Um [novo benchmark independente](BENCHMARK_REPRODUCIBLE.md) acompanha esta atualização: D seleciona 198 ganhos contra 165 de A, com AUC média 0,541, sob as restrições ali documentadas. O limite de 138 dias e o desenho de features já eram conhecidos a partir do dataset; não é validação prospectiva nem conjunto intocado.
- **Mudança de população:** contas, produtos, preços, processo e mercado podem diferir da amostra de 2017. O artefato congelado requer monitoramento e recalibração futura com dados mais recentes e desfechos observados.
- **Survivor bias / negócios antigos:** comparar apenas encerrados ou usar idade como sinônimo de qualidade pode ignorar os abertos ainda sem desfecho. A fila de revalidação preserva esses negócios sem atribuir automaticamente propensão baixa ou alta. Tampouco os coloca acima de Venda ativa por um percentil de preço.

## Operação comercial

- **Ação não substitui julgamento:** “trabalhar agora”, “enriquecer”, “revalidar” e “qualificar” são orientações geradas pelas bases disponíveis. Contato, necessidade, prazo e qualidade dos dados precisam de confirmação humana.
- **Status e etapa:** o Kanban mostra ganhos e perdidos em Finalização para evitar desaparecimento visual. A apresentação dessa coluna não reconstrói uma sequência histórica de etapas ausente nos CSVs.
- **Data do snapshot:** o cálculo temporal está ancorado em 31/12/2017 e o cadastro novo impõe datas compatíveis. A aplicação é uma demonstração da lógica validada; não se deve aplicar o artefato sem recalibração a um pipeline atual como se o tempo histórico continuasse vigente.
- **Filtros e Top 5:** a consulta separa o universo aberto filtrado e seleciona até cinco por fila; mudanças nos filtros alteram quem aparece, não os parâmetros do modelo. Cada Top 5 é local à sua fila, não uma garantia de cinco vitórias ou uma prioridade entre filas.

## Infraestrutura

- **SQLite local:** o arquivo operacional foi escolhido para persistência sem credenciais e uso local. Não fornece, nesta entrega, isolamento multiempresa, autenticação, autorização por usuário, acesso concorrente distribuído ou operação cloud.
- **E-mail:** prévia, agendamentos, idempotência local e testes de adaptação estão implementados. O envio real via Resend depende de chave, remetente autorizado e worker separado; **não foi validado em produção**. Entregabilidade, reputação do domínio e comportamento sob falhas de rede exigem validação própria.
- **Sem integrações externas de CRM ou WhatsApp:** a operação é interna à aplicação local. Não há sincronização bidirecional, controle de conflitos ou consentimento/cadência de mensagens implementados.

## Validação e evolução

Os scripts disponíveis cobrem dados, paridade 2.089/2.089, operações, prioridades, Dashboard, e-mail e modelo do produto. Esses checks não substituem teste prospectivo, monitoramento de drift, auditoria de acesso ou ensaio de carga. O protótipo anterior foi referência de comparação, não a entrega principal.

Para uma carteira maior ou múltiplos usuários, seriam pertinentes medições de desempenho e, se necessário, otimizações de carregamento/recomposição de snapshot, consultas e atualização incremental. **Nenhuma melhoria de performance ou ganho de escala é reivindicado nesta entrega.** O [caminho para produção](PRODUCTION_PATH.md) descreve etapas possíveis, ainda não implementadas.

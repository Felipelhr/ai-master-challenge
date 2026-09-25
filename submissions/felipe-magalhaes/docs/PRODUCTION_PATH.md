# Caminho possível para produção

O G4 Lead Scorer entregue em [`../solution/`](../solution/) é uma aplicação local para o Challenge 003. As propostas abaixo são **evoluções possíveis**, não componentes implementados ou validados nesta entrega. A prioridade inicial deve ser confirmar utilidade comercial, governança dos dados e qualidade prospectiva antes de ampliar automação.

## 1. Dados e medição

Integrar oportunidades, contas, produtos, atividades e desfechos a um CRM de origem, com identificadores estáveis, datas de atualização e regras explícitas para conflitos. Registrar alterações de estágio, contatos e respostas; manter versões point-in-time da firmografia para evitar vazamento retrospectivo. Incluir preço praticado, margem/custo e capacidade comercial se o objetivo de priorização passar a ser retorno econômico líquido. Definir um período de observação prospectiva e comparar a fila sugerida com uma regra simples e com decisões reais dos vendedores, sem confundir captura retrospectiva com impacto causal.

## 2. Persistência, identidade e isolamento

Migrar o estado operacional do SQLite local para um banco transacional compartilhado, como **PostgreSQL** ou uma implantação **Supabase/Postgres**, por meio de migrações revisadas e teste de consistência. Definir autenticação e autorização por papel; modelar empresa/ambiente de trabalho e vínculo de usuários, oportunidades e agendamentos. Se a aplicação usar acesso direto do cliente a tabelas expostas, criar e testar políticas **RLS** coerentes com a empresa e o usuário, além de controles de acesso no servidor. O seletor visual de ambiente atual é apenas indicação de evolução futura; ele não implementa multiempresa nem isolamento de dados.

## 3. Integrações e execução agendada

Criar integração de CRM com reconciliação e idempotência de importação; nenhuma integração bidirecional existe agora. Avaliar WhatsApp como canal futuro somente depois de definir origem dos contatos, autorização, consentimento, regras de cadência e registro das interações. Mover o worker local de e-mail para um **scheduler cloud** com execução confiável, segredos gerenciados, prevenção de duplicidade, retry controlado e trilha de envios. Testar o provedor real, domínio e entregabilidade em ambiente próprio antes de depender dos e-mails na operação.

## 4. Observabilidade, auditoria e segurança

Adicionar métricas e alertas para ingestão, tarefas, simulação, ranking, latência e envios; registrar versões do modelo e falhas sem expor dados sensíveis. Manter **audit trail** de mudanças de oportunidade, etapa, status, tags, tarefas, filtros de agendamento e disparos. Definir retenção, backup/restauração, separação de ambientes e tratamento de credenciais. Medir desempenho com volume e concorrência reais antes de escolher cache, recomposição incremental ou outras otimizações.

## 5. Recalibração e liberação gradual

Reavaliar cobertura temporal, taxas por faixa, calibração da propensão, estabilidade entre segmentos e drift com dados novos e firmografia datada. Reexecutar benchmarks com scripts, cortes e saídas preservados; documentar intervalos de incerteza e comparar o método com preço puro e regras de qualificação. Versionar artefato, referências, data de corte e critérios de promoção; validar em sombra antes de alterar a fila visível. Acompanhar se recomendações realmente melhoram contato e resultado, sem tratar Score ou Lead Tier como probabilidade.

Essas etapas ficaram fora da entrega porque o Challenge 003 podia ser resolvido com uma aplicação local, dados fornecidos, artefato congelado e verificações reproduzíveis. Nenhum banco PostgreSQL/Supabase, login, RLS, multiempresa, integração CRM/WhatsApp, scheduler cloud ou recalibração contínua foi implementado aqui.

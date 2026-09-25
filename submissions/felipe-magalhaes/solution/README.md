# G4 Lead Scorer — aplicação local

Aplicação do Challenge 003 para organizar oportunidades comerciais por Score de Prioridade, valor exibido e próximo passo. Inclui Lista, Kanban, workspace, tarefas, tags, anotações, Top 5, Dashboard, simulação, cadastro de oportunidade e resumo de prioridades por e-mail. A [documentação principal da submissão](../README.md) explica problema, decisões, resultados e limites; a [metodologia](../docs/METHODOLOGY.md) descreve o scoring em detalhe.

## Requisitos e instalação

- Node.js **24 ou superior** e npm.
- Dependências instaladas a partir do `package-lock.json`.
- Python não é necessário para rodar o produto; os scripts Python servem para regenerar o artefato de scoring.

Execute os comandos abaixo **nesta pasta `solution/`**:

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. Para uma execução de produção local:

```bash
npm run build
npm run start
```

O SQLite nativo de Node 24 pode emitir um aviso de recurso experimental. Na primeira abertura, a aplicação cria e inicializa `data/arena-operations.sqlite` com o estado operacional; esse arquivo local não é versionado. Os cinco CSVs em `data/` são a base histórica e não são sobrescritos.

## Configuração e e-mail

`ARENA_DB_PATH` é opcional e permite escolher outro caminho para o SQLite operacional. Para envio real pelo Resend, copie `.env.example` para `.env.local` e preencha `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com uma chave e remetente autorizado. **Não versione `.env.local` nem credenciais.** Sem essas variáveis, a prévia e os agendamentos locais funcionam, mas o envio fica desabilitado. O envio real não foi validado em produção nesta entrega.

O worker de agendamentos é um **processo separado** do servidor web:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run email:worker
```

`npm run email:worker -- --once` faz uma única checagem. Os agendamentos e logs de envio usam o mesmo SQLite local.

## Dados, Score e interface

O snapshot do artefato é **31/12/2017**. O treinamento do modelo coberto usa **nove cortes mensais de março a novembro de 2017**, registrados em `src/domain/scoring/model-artifact.json`. As 2.089 oportunidades abertas recebem Score; negócios encerrados não têm Score operacional atual. O Score é prioridade relativa, **não probabilidade de fechamento**. O Lead Tier é uma classificação comercial separada.

Lista, Kanban e Top 5 aplicam a mesma ordem padrão: **Score DESC → Valor exibido DESC → ID**. O Top 5 seleciona oportunidades abertas com Score no recorte filtrado e é reutilizado em Prioridades, Tarefas, Dashboard e digest. Filtros mudam o universo exibido, não o artefato de scoring.

**Funil**, **Etapa** e **Status** são conceitos separados. As etapas padrão visíveis no Kanban são Prospecção, Em negociação e Finalização. Negócios abertos ficam normalmente nas duas primeiras; ganhos e perdidos aparecem em Finalização. As três colunas permanecem visíveis, e o filtro de Status determina quais cards aparecem. Para negócios históricos encerrados, o dataset não informa a última etapa operacional; Finalização é a apresentação no Kanban.

## Estrutura essencial

| Caminho | Função |
| --- | --- |
| `data/` | Cinco CSVs originais; SQLite operacional criado em execução. |
| `src/domain/scoring/` | Motor TypeScript, contratos, rótulos e artefato congelado. |
| `src/domain/tiering/` | Lead Tier e referências fixas. |
| `src/repositories/` | Leitura dos CSVs e persistência operacional SQLite. |
| `src/services/` | CRM, ranking, Dashboard, scoring, Tier e e-mail. |
| `src/components/` e `src/app/` | Interface Next.js, páginas e Server Actions. |
| `scripts/` | Verificações, worker e regeneração de artefatos. |

## Verificações disponíveis

```bash
npm run verify:data
npm run verify:scoring
npm run verify:operations
npm run verify:priorities
npm run verify:dashboard
npm run verify:email
npm run verify:product:model
npm run verify:product:ux
npm run lint
npm run build
```

`verify:scoring` verifica paridade dos **2.089/2.089** negócios abertos com a fixture legada e quatro casos novos. A inferência web lê o artefato versionado e não treina o modelo em tempo de execução. Para reprodução do treinamento, consulte `scripts/scoring/build-model-artifact.py` e `scripts/scoring/requirements.txt`.

Leia a [submissão principal](../README.md), o [Process Log](../process-log/PROCESS_LOG.md), a [metodologia](../docs/METHODOLOGY.md), as [limitações](../docs/LIMITATIONS.md) e o [caminho possível para produção](../docs/PRODUCTION_PATH.md) para o contexto completo.

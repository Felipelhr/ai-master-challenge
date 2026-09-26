# G4 Lead Scorer — aplicação local

Aplicação do Challenge 003 para organizar oportunidades comerciais em três filas independentes: Venda ativa, Revalidação e Qualificação. Inclui Lista, Kanban, workspace, tarefas, tags, anotações, Top 5, Dashboard, simulação, cadastro de oportunidade e resumo de prioridades por e-mail. A [documentação principal da submissão](../README.md) explica problema, decisões, resultados e limites; a [metodologia](../docs/METHODOLOGY.md) descreve o scoring em detalhe.

## Requisitos e instalação

- Node.js **24 ou superior** e npm.
- Dependências instaladas a partir do `package-lock.json`.
- Python não é necessário para rodar o produto; os scripts Python servem para regenerar o artefato de scoring ou reproduzir o benchmark opcional.

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

O snapshot do artefato é **31/12/2017**. O treinamento do modelo coberto usa **nove cortes mensais de março a novembro de 2017**, registrados em `src/domain/scoring/model-artifact.json`. As 2.089 oportunidades abertas continuam cobertas pelo motor histórico. A interface exibe Score somente nos 298 negócios com estimativa temporal, em Venda ativa; 1.291 ficam em Revalidação e 500 em Qualificação, ordenados por valor. Os percentis econômicos legados permanecem internos para paridade. Negócios encerrados não têm Score operacional atual. O Score é prioridade relativa, **não probabilidade de fechamento**. O Lead Tier é uma classificação comercial separada.

Lista e Kanban apresentam grupos identificados. Há um **Top 5 por fila**, compartilhado por Prioridades, Tarefas, Dashboard e digest. **Venda ativa: Score DESC → Valor DESC → ID. Revalidação e Qualificação: Valor DESC → ID.** Não há ranking global nem distribuição automática de atenção entre filas. Filtros mudam o universo exibido, não o artefato de scoring. Filtros numéricos de Score se aplicam somente à Venda ativa. Dashboard calcula média de Score e valor priorizado somente nessa fila.

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

## Benchmark retrospectivo opcional

O novo experimento é separado do benchmark antigo reportado no handoff. Não altera o artefato usado pela aplicação. Requer Python 3.12 e as versões fixadas:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r scripts/scoring/requirements.txt
python scripts/scoring/temporal-benchmark.py --check
```

Sem `--check`, o script regenera somente `scripts/scoring/benchmark-results/`. Com `--check`, retreina por corte e confere resultados e IDs selecionados contra os arquivos incluídos. Veja [protocolo, resultados e limitações](../docs/BENCHMARK_REPRODUCIBLE.md).

O fingerprint de dados preserva o hash original usando terminações CRLF canônicas: checkouts LF e CRLF passam; mudanças reais em valores continuam sendo detectadas.

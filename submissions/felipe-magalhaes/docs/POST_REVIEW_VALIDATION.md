# Validação local após revisão externa — 26/09/2026

Base: `b63d22eedf0f4d3a6c27bef753a2be39ab7ce408`, versão publicada originalmente no PR #160. Esta rodada prepara uma atualização local para revisão humana; não registra publicação.

## Alteração central

Três filas explícitas: Venda ativa (298), Revalidação (1.291) e Qualificação (500). Apenas a primeira compara Score temporal. As demais usam Valor → ID. Cada fila tem até cinco itens; não existe ranking global nem regra automática de divisão do tempo entre filas.

O modelo/fallback, os coeficientes e referências do artefato, o cálculo do Lead Tier e a fixture histórica foram preservados. O fingerprint foi tornado independente de CRLF/LF. Um benchmark novo, com protocolo e resultados próprios, foi incluído; não é uma reprodução do experimento antigo.

## Evidência executada

| Verificação | Resultado |
| --- | --- |
| Oito suítes `verify:*` em Windows e Linux | PASS |
| Paridade histórica em Windows e Linux | 2.089/2.089; Score/base/evidência/ação/sinais iguais |
| Contagens das quatro bases | 89 / 209 / 1.291 / 500 |
| Lead Tier | Distribuição preservada: A+ 43, A 70, B+ 116, B 514, C 618, D 418, E 310 |
| Ordenação e filtros | Top 5 por fila, determinismo, empate por Valor, isolamento de Score e paridade com Lista |
| E-mail | Prévia e envio mockado, filtros, idempotência e ausência de credenciais; nenhum envio real |
| Lint e build | PASS em Windows e Linux |
| Instalação limpa Linux | `npm ci` pelo lockfile; Node 24.18.1, Linux musl em WSL |
| Primeiro acesso Linux | HTTP responde; SQLite criado sem banco prévio e sem credenciais Resend |
| Novo benchmark Python | Geração e `--check` reproduzem métricas e IDs selecionados |

O teste Linux usou uma cópia temporária com arquivos de texto em LF, sem dependências, build ou SQLite copiados da máquina Windows. Esses arquivos de execução ficaram fora da submissão. A primeira tentativa de build encontrou um ícone corrompido pela conversão indevida de binários na cópia temporária; a cópia foi corrigida para converter somente texto. O ícone da solução original não foi alterado.

## Verificação no navegador

- Lista: três grupos e totais 298/1.291/500; Score restrito a Venda ativa.
- Prioridades: cinco cards por fila; filtro Revalidação mantém somente seu grupo.
- Workspace de revalidação: “Por valor”, sem Score numérico; explicação de ausência de cobertura.
- Dashboard: Top 5 separado e média de Score restrita a Venda ativa; filtro Revalidação mostra média “—”.
- Tarefas: os três grupos do Top 5 presentes.
- Kanban: grupos nas etapas; Ganhos permanecem em Finalização (4.238), com etapas abertas visíveis e vazias.
- Digest: prévia com até 15 itens em três filas e numeração reiniciada por fila; envio real desabilitado sem Resend.

## Interpretação e limites

O [benchmark novo](BENCHMARK_REPRODUCIBLE.md) tem AUC média de 0,541 para D e 0,542 para C, evidência de discriminação fraca. Não comprova calibração, efeito causal, receita futura nem a melhor alocação de esforço comercial. A aplicação permanece local, ancorada no snapshot de 2017. Autenticação, isolamento entre empresas e validação de entrega real de e-mail continuam fora desta rodada.

A publicação depende de revisão e aprovação de Felipe. O relato autoral inicial e as capturas históricas foram preservados, com adendos identificados. Esta rodada adicional não é incluída na estimativa original de seis horas.

# Exemplo prático — da fila ao próximo passo

Este guia demonstra funções existentes do G4 Lead Scorer com três oportunidades reais do dataset. É um roteiro de avaliação e uso; não relata contatos comerciais executados nem resultados de clientes. Os nomes e valores são da base do challenge, e as idades são calculadas no snapshot **31/12/2017**, não na data atual.

## 1. Abrir a carteira de um vendedor

Depois do [setup da aplicação](../solution/README.md), abra **Prioridades → Limpar filtros → Vendedor: Niesha Huffines**. Mantenha os demais filtros em **Todos**.

Na base inicial, o recorte tem **64 oportunidades abertas**: duas em Venda ativa, 28 em Revalidação e 34 em Qualificação. Cada fila mostra até cinco destaques; Venda ativa mostra apenas duas porque só existem duas nesse recorte. O filtro **Fila de trabalho** permite concentrar a tela em um objetivo.

## 2. Definir o objetivo do trabalho

| Objetivo escolhido pelo vendedor/gestão | Fila a consultar | Decisão apoiada pelo produto |
| --- | --- | --- |
| Trabalhar negociações dentro da cobertura temporal | Venda ativa | Conferir Score, evidência e ação antes do próximo contato |
| Atualizar o contexto de negociações antigas | Revalidação | Revalidar interesse, começando pelo maior valor dentro da fila |
| Conhecer necessidade, contato e prazo de novas oportunidades | Qualificação | Qualificar a oportunidade, começando pelo maior valor dentro da fila |

Esta tabela explica os objetivos; não estabelece uma fila superior às outras nem uma divisão ótima do tempo. Compromissos já assumidos e informações obtidas pelo vendedor também precisam ser considerados. O sistema não mede automaticamente toda essa informação.

## 3. Inspecionar três casos reais

Os exemplos abaixo são o **primeiro item de cada fila** para essa vendedora no estado inicial. Abra o card e selecione a aba **Inteligência** para conferir a explicação. Depois use **Tarefas** e **Anotações** para trabalhar no contexto da mesma oportunidade.

### Venda ativa — `PYQ3VX08`

- **Conta:** não informada. **Produto:** GTX Pro. **Valor:** US$ 4.821.
- **Tempo em negociação:** 138 dias. **Score:** 65, somente dentro de Venda ativa.
- **Base:** fallback temporal por ausência de conta. **Evidência:** Menor. **Lead Tier:** B.
- **Ação exibida:** Enriquecer dados da conta.
- **Tarefa inicial:** Completar dados da conta.

O Score não informa 65% de chance de fechar. Há uma estimativa temporal simplificada, sem os atributos da empresa. Antes de priorizar contato, a ação é validar quem é a conta e obter contexto. Na aplicação de demonstração, pode-se registrar o que foi apurado em **Anotações** e organizar a tarefa existente; não se deve fingir que uma anotação, por si só, enriquece automaticamente as features do modelo.

### Revalidação — `BBOWBQA6`

- **Conta:** Blackzim. **Produto:** GTX Plus Pro. **Valor:** US$ 5.482.
- **Tempo em negociação:** 164 dias, fora da cobertura adotada de 138 dias.
- **Prioridade exibida:** Revalidação · por valor, sem Score temporal. **Evidência:** Menor. **Lead Tier:** B+.
- **Ação exibida:** Revalidar por contato.
- **Tarefa inicial:** Fazer última tentativa de contato.

A posição decorre do valor dentro da fila, não de uma previsão de fechamento. A tarefa existente orienta revalidar o interesse antes de considerar congelamento ou encerramento; o título não é evidência de tentativas anteriores no dataset. **164 dias não prova perda.** O resultado de um contato real deve orientar a anotação e o próximo passo; nenhuma perda ou congelamento ocorre automaticamente por essa idade.

### Qualificação — `DDHNCZMO`

- **Conta:** Konex. **Produto:** GTX Plus Pro. **Valor:** US$ 5.482.
- **Entrada em negociação:** ausente, pois está em prospecção.
- **Prioridade exibida:** Qualificação · por valor, sem Score temporal. **Evidência:** Menor. **Lead Tier:** A+.
- **Ação e tarefa inicial:** Qualificar oportunidade.

O Tier A+ descreve potencial comercial pela heurística; não é probabilidade de fechamento. O próximo passo é identificar necessidade, contato e prazo. Somente se a situação comercial justificar entrar em negociação, a operação de mudança de etapa exige a data de entrada compatível com o snapshot histórico. Não avance a etapa apenas para obter um Score.

## 4. Organizar a execução no workspace

Em uma cópia de avaliação, os passos abaixo podem ser experimentados sem alegar uma atividade comercial real:

1. Na aba **Tarefas**, localize a tarefa inicial indicada no exemplo. Ela começa pendente e sem vencimento. Use **Editar**, defina um vencimento coerente com a agenda de demonstração e clique em **Salvar**. Reaproveite a tarefa existente em vez de criar uma duplicata.
2. Em **Anotações → + Nova anotação**, registre contexto. Para um teste, use um texto explicitamente demonstrativo, como: “Demonstração: conferir cadastro antes do contato; nenhuma interação com cliente foi realizada.” Clique em **Salvar**.
3. Após executar uma tarefa real, marque a caixa da tarefa como concluída. Se houver próximo passo, crie-o em **+ Nova tarefa**, com título e vencimento adequados. Em uma demonstração, deixe claro que se trata de teste.
4. Feche e reabra a oportunidade: tarefa e anotação permanecem no SQLite local. A tela **Tarefas** reúne as mesmas atividades; voltar a **Prioridades** permite escolher a próxima oportunidade dentro da fila desejada.

Não é preciso cadastrar uma nova oportunidade, configurar Resend ou enviar e-mail para seguir este roteiro. Se o banco já tiver sido usado, tarefas concluídas/excluídas ou alterações de Status podem mudar os cards e as contagens; os exemplos descrevem a base inicial.

## O que este exemplo permite avaliar

- A decisão é contextual: cada fila tem uma finalidade e uma ordem verificável.
- Falta de conta gera orientação de enriquecimento, sem atributos empresariais inventados.
- Ausência de cobertura temporal fica explícita, sem converter idade em perda.
- Explicação, ação, tarefa e registro ficam disponíveis na mesma oportunidade.
- O uso operacional é demonstrável; aumento de conversão ou receita continua sendo uma hipótese a validar. Consulte o [benchmark por corte](BENCHMARK_REPRODUCIBLE.md#estabilidade-nos-seis-cortes).

export function HowItWorks() {
  return <article className="how-page">
    <header className="how-intro">
      <span className="how-eyebrow">GUIA DO PRODUTO</span>
      <h2>Como funciona o G4 Lead Scorer</h2>
      <p>Uma carteira grande dificulta decidir qual oportunidade trabalhar primeiro. O G4 Lead Scorer organiza três filas independentes, mostra o motivo da ordem em cada uma e reúne o contexto do negócio para o próximo passo comercial. É uma ferramenta de priorização com componente preditivo limitado.</p>
    </header>

    <section className="how-card"><h3>Três objetivos, três filas</h3><p><strong>Venda ativa:</strong> 298 negócios históricos com estimativa temporal (89 modelo completo e 209 fallback). <strong>Revalidação:</strong> 1.291 além da cobertura adotada. <strong>Qualificação:</strong> 500 em prospecção.</p><p>As contagens são do snapshot original de 31/12/2017. Só 14,3% dos abertos têm estimativa temporal. A escolha de como dividir atenção entre filas é comercial; o sistema não demonstra que uma delas deva sempre vir antes das outras. Mais de 138 dias não significa negócio perdido.</p></section>

    <div className="how-grid">
      <section className="how-card">
        <span className="how-number">01 · Prioridade</span>
        <h3>Score de Prioridade</h3>
        <p>O Score de Prioridade organiza somente a fila de <strong>Venda ativa</strong>, com estimativa temporal, numa escala relativa de 0 a 100. Qualificação e Revalidação usam ordenação por valor e não exibem esse Score. Não comparamos números calculados em referências diferentes.</p>
        <p><strong>Score não é probabilidade de fechamento, previsão de receita, Lead Tier nem simples ordenação por ticket.</strong> Score 100 indica prioridade alta na fila; não significa 100% de chance de ganhar.</p>
      </section>
      <section className="how-card">
        <span className="how-number">02 · Potencial</span>
        <h3>Lead Tier</h3>
        <p>Lead Tier é uma heurística descritiva, com pesos definidos por julgamento comercial e sem validação preditiva própria. Classifica o potencial comercial de A+ a E com referências fixas: <strong>50%</strong> potencial econômico do produto, <strong>25%</strong> receita da empresa, <strong>10%</strong> número de funcionários e <strong>15%</strong> completude cadastral.</p>
        <p>Receita ou funcionários desconhecidos recebem referência neutra, não zero; a falta desses dados também aparece separadamente na completude. Informação de controladora não é campo obrigatório dessa completude.</p>
        <p><strong>Lead Tier não é probabilidade, não altera o Score de Prioridade e não determina sozinho o Top 5.</strong></p>
      </section>
      <section className="how-card">
        <span className="how-number">03 · Suporte</span>
        <h3>Qualidade da Evidência</h3>
        <p>Mede quanto suporte informacional existe para a análise. <strong>Maior</strong> indica informação suficiente para aplicar o modelo completo. <strong>Menor</strong> indica que a análise depende de uma referência temporal simplificada, está em prospecção ou passou do período coberto pelo histórico.</p>
        <p>Não mede qualidade comercial do lead, chance de fechamento nem potencial econômico. Maior não garante fechamento; Menor não significa oportunidade ruim.</p>
      </section>
      <section className="how-card">
        <span className="how-number">04 · Próximo passo</span>
        <h3>Ação Recomendada</h3>
        <p>Traduz o contexto em uma orientação prática: trabalhar agora, enriquecer os dados da conta, qualificar a oportunidade ou revalidar por contato. A recomendação vem acompanhada de motivo e limitações.</p>
      </section>
    </div>

    <section className="how-card">
      <span className="how-number">METODOLOGIA</span>
      <h3>Como o Score é formado</h3>
      <p><strong>Em negociação, conta identificada, de 0 a 138 dias:</strong> o modelo completo considera tempo em negociação, produto, setor, receita, funcionários, idade da empresa e informação de grupo ou controladora quando disponível. Ele estima, com base histórica, a propensão de fechamento nos próximos 30 dias. Essa estimativa é combinada ao valor econômico do produto para formar a prioridade operacional; não é garantia de fechamento.</p>
      <p><strong>Em negociação, conta não identificada, de 0 a 138 dias:</strong> usamos uma referência histórica pela faixa de tempo em negociação, combinada ao valor do produto. Não inventamos características da empresa. A evidência é Menor; a ausência da conta não é automaticamente um sinal de negócio ruim.</p>
      <p><strong>Em negociação há mais de 138 dias:</strong> o histórico não sustenta uma propensão temporal além desse limite. O negócio entra na fila de revalidação, com prioridade baseada no valor relativo do produto e recomendação de contato para revalidá-lo.</p>
      <p><strong>Prospecção:</strong> ainda não há data de entrada em negociação. Sem esse tempo, não aplicamos o modelo temporal nem criamos uma probabilidade artificial. O negócio é priorizado pelo valor relativo do produto na fila de prospecção e recebe orientação de qualificação.</p>
      <p><strong>O sistema prefere assumir explicitamente quando não possui suporte histórico suficiente a inventar precisão onde os dados não permitem.</strong></p>
    </section>

    <section className="how-card how-order">
      <span className="how-number">REGRA DE ORDENAÇÃO</span>
      <h3>Em Venda ativa: Score primeiro, ticket no empate</h3>
      <p>Dentro de <strong>Venda ativa</strong>, modelo completo e fallback estimam o mesmo alvo de 30 dias e usam a mesma referência de Score. Entre oportunidades com o mesmo Score, o maior Valor/Ticket exibido vem primeiro. Persistindo o empate, o ID mantém a ordem estável. A comparabilidade preditiva entre modelo e fallback ainda requer avaliação.</p>
      <div className="how-example" aria-label="Exemplo de ordenação">
        <div><span>1º</span><strong>Score 100</strong><span>Valor 80k</span></div>
        <div><span>2º</span><strong>Score 100</strong><span>Valor 20k</span></div>
        <div><span>3º</span><strong>Score 99</strong><span>Valor 500k</span></div>
      </div>
      <p>Este exemplo vale dentro de Venda ativa: o negócio de 500k vem depois porque o Score 99 está abaixo dos dois negócios de Score 100. Em Qualificação e Revalidação, a ordem é Valor decrescente e ID; não há estimativa temporal.</p>
    </section>

    <div className="how-grid">
      <section className="how-card">
        <h3>Top 5 por fila e filtros</h3>
        <p>Há <strong>um Top 5 por fila</strong>, sempre de oportunidades abertas. Os filtros são aplicados antes da ordenação. Venda ativa usa Score decrescente, Valor decrescente e ID; Revalidação e Qualificação usam Valor decrescente e ID. Lista e Kanban mostram grupos identificados. Prioridades, Tarefas, Dashboard e e-mail compartilham os mesmos grupos. A ordem de apresentação das filas não determina qual trabalhar primeiro, nem a divisão do tempo entre elas.</p>
      </section>
      <section className="how-card">
        <h3>Funil, Etapa e Status</h3>
        <p><strong>Funil</strong> representa o processo comercial. As etapas padrão são <strong>Prospecção</strong>, <strong>Em negociação</strong> e <strong>Finalização</strong>. <strong>Status</strong> registra se o negócio está Aberto, Ganho ou Perdido. Status e Etapa são conceitos separados; Ganho e Perdido não são etapas.</p>
        <p>Negócios abertos ficam normalmente em Prospecção ou Em negociação. Ganhos e perdidos aparecem em Finalização no Kanban. As três colunas permanecem visíveis: o filtro Aberto mostra negócios abertos; Ganho ou Perdido mostra os respectivos negócios em Finalização; Todos mostra o universo completo.</p>
      </section>
      <section className="how-card">
        <h3>Dados ausentes</h3>
        <p>Em negociação e dentro da cobertura temporal, uma conta não identificada usa estimativa baseada na faixa de tempo e recebe evidência Menor; a ausência da conta não reduz diretamente o Score. No Lead Tier, medidas de porte ausentes recebem referência neutra, enquanto a completude reflete os campos disponíveis.</p>
      </section>
      <section className="how-card">
        <h3>Cobertura e limites</h3>
        <p>O histórico observado cobre até 138 dias em negociação. Acima desse limite, não há propensão temporal confiável: a prioridade usa o valor relativo do produto na fila de revalidação. Em prospecção, sem data de entrada em negociação, também não há probabilidade temporal.</p>
        <p>Os atributos cadastrais das empresas são retratos do dataset, não séries históricas que mostram cada atributo no momento do negócio. Estimativas históricas não garantem resultado futuro. O Score orienta a ordem dentro de Venda ativa. O benchmark retrospectivo não prova receita adicional ou desempenho futuro. O vendedor ainda precisa validar dados, contexto e próximo contato.</p>
      </section>
    </div>
  </article>;
}

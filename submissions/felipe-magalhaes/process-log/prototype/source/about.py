import pandas as pd
import streamlit as st


def render_about():
    st.header("Como funciona")
    st.write("O Lead Priority Engine ajuda o time comercial a decidir onde agir primeiro. Cada oportunidade recebe um Score de Prioridade de 0 a 100, uma ação recomendada, tags operacionais e uma explicação simples. O Score não representa a chance de fechamento. Ele representa prioridade relativa dentro da carteira.")
    cols = st.columns(4)
    for col, title, body in zip(cols, ["PRIORIZAR", "EXPLICAR", "AGIR", "OPERACIONALIZAR"], ["Quem merece atenção primeiro.", "Por que recebeu aquele score.", "Próxima ação comercial recomendada.", "Filtrar, organizar tarefas e exportar oportunidades."]):
        with col:
            with st.container(border=True):
                st.markdown(f"**{title}**")
                st.caption(body)

    st.header("Como calculamos")
    st.info("OPORTUNIDADE → ANÁLISE → PRIORIDADE → AÇÃO → TAGS")
    rows = [
        ["Em negociação + dados completos", "Modelo histórico + valor econômico", "Média", "Score completo"],
        ["Em negociação + conta incompleta", "Histórico pela idade + valor", "Baixa", "Score + enriquecer dados"],
        ["Fora da cobertura histórica", "Potencial econômico", "Baixa", "Score + revalidar situação"],
        ["Prospecção", "Potencial econômico", "Baixa", "Score + qualificar"],
    ]
    st.dataframe(pd.DataFrame(rows, columns=["Situação", "Cálculo", "Confiança", "Resultado"]), hide_index=True, width="stretch")
    st.write("Quanto melhor a evidência disponível, mais completo é o cálculo. Quando os dados são insuficientes, o sistema não inventa precisão: reduz a confiança e recomenda uma ação adequada.")

    st.header("Do insight à ação")
    a, b = st.columns(2)
    a.markdown("**Trabalhar agora** → atuar comercialmente.\n\n**Enriquecer dados da conta** → completar cadastro antes da próxima tentativa.\n\n**Última tentativa antes de congelar** → revalidar oportunidade.")
    b.markdown("**Qualificar oportunidade** → obter contexto comercial.\n\n**Follow-up automatizado** → manter cadência após o contato humano.")
    st.write("Os grupos podem ser filtrados e exportados em CSV para CRM, enriquecimento ou ferramentas de disparo.")
    st.caption("Follow-up automatizado é recomendação operacional. O dataset não possui histórico de atividades; essa tag não participa da previsão.")

    st.header("Quem fez o quê")
    people = [
        ("Felipe Magalhães", "Product Owner / RevOps / decisão", "Formulou o problema operacional e conduziu o raciocínio lógico e comercial do projeto. Questionou conclusões baseadas apenas em volume absoluto, exigiu denominadores e taxas para evitar interpretações enganosas e confrontou hipóteses das diferentes IAs entre si. Usou a triangulação entre Sam Agent, Claude, Astra e ChatGPT para procurar inconsistências, vieses, vazamentos e possíveis pegadinhas dos dados antes de aceitar qualquer conclusão. Conectou os resultados estatísticos ao impacto econômico e à operação comercial, decidiu quais hipóteses seriam aceitas ou descartadas e definiu a transformação do modelo em produto: Score de Prioridade, confiança, ações recomendadas, tags, tarefas, recuperação de leads e exportação. As decisões finais de lógica de negócio e produto foram humanas."),
        ("Samantha (Sam Agent)", "Agente pessoal e profissional de IA de Felipe", "A Sam Agent atua como apoio à análise de contexto, problemas, coordenação e decisões de Felipe, em papel semelhante ao de um Jarvis. Neste projeto, coordenou o trabalho com diferentes IAs, explorou os dados, identificou censura e limites históricos, executou validação temporal e desenvolveu o benchmark e o modelo híbrido final."),
        ("Claude", "Challenger analítico", "Transformou achados em hipóteses operacionais; propôs filas e explicabilidade; testou hipótese e identificou viés de sobrevivência que levou à correção."),
        ("Astra", "Auditoria independente", "Reproduziu cálculos; auditou conclusões; identificou fragilidades metodológicas e realizou teste forward-30 independente."),
        ("ChatGPT", "Síntese / arquitetura de produto", "Cruzou análises; questionou interpretações causais; consolidou Score + Confiança + Ação + Tags e ajudou a transformar o modelo em ferramenta de RevOps."),
        ("Codex", "Engenharia", "Transformou a especificação em software funcional: scoring engine, interface, persistência, filtros, tarefas e operação."),
    ]
    for person, role, contribution in people:
        with st.container(border=True):
            st.markdown(f"**{person}** · {role}")
            with st.expander("Ver contribuição completa"):
                st.write(contribution)

    st.header("Como construímos")
    st.write("O projeto começou com uma pergunta: onde um vendedor deveria gastar seu tempo? Desde o início, Felipe tratou as respostas das IAs como hipóteses a serem confrontadas, não como conclusões automáticas. Colocou diferentes modelos em papéis independentes de análise, crítica e auditoria para comparar conclusões, procurar vieses e possíveis pegadinhas e testar interpretações antes de levá-las ao produto. Samantha (Sam Agent), sua agente pessoal e profissional de IA em papel semelhante a uma Jarvis, apoiou a análise de contexto e a coordenação deste projeto. Claude desafiou as hipóteses, Astra auditou cálculos e limites, e ChatGPT ajudou a consolidar a arquitetura de Score, confiança, ação e tags. Felipe tomou as decisões finais de lógica de negócio e produto; Codex implementou o software.")
    st.write("O resultado é uma ferramenta de RevOps para ajudar pessoas a decidir, agir e organizar melhor a carteira.")
    with st.expander("Metodologia e limites do benchmark"):
        st.write("A validação temporal reportada pela Sam para top 5 por vendedor em seis cortes encontrou US$ 1.347.335 capturados pelo método D e US$ 1.169.680 por idade × preço; AUC média de 0,658 versus 0,622. Os scripts originais da Sam não vieram neste pacote, então esses números são reportados, não reproduzidos aqui. A auditoria independente confirmou contagens e filas, mas executou outro benchmark exploratório.")
        st.write("Preço de catálogo não é margem; não há histórico de atividades nem de atualização firmográfica; negócios abertos têm desfecho desconhecido; 138 dias não é prazo de expiração.")

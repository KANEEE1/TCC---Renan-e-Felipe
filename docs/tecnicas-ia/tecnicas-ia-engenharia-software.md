# Técnicas de IA Aplicadas à Engenharia de Software no TCC

## Propósito deste documento

Este TCC tem dois entregáveis interligados (ver `CLAUDE.md`): (1) uma plataforma de gestão acadêmica para cursinhos populares, e (2) uma investigação de como técnicas modernas de desenvolvimento assistido por IA foram empregadas *durante a construção* dessa plataforma. Este documento cobre a parte teórica da segunda frente: define cada técnica, explica como pretendemos aplicá-la neste projeto e referencia a literatura correspondente.

Importante: nenhuma das técnicas abaixo deve virar uma funcionalidade voltada ao usuário final do sistema (gestores, professores, alunos). Elas são ferramentas do processo de desenvolvimento — o produto entregue continua sendo uma plataforma de gestão convencional, sem IA embutida, conforme já definido em "Out of Scope" no `CLAUDE.md`.

As cinco técnicas não são independentes: juntas, formam a arquitetura de um agente de codificação como o que está sendo usado neste projeto (Claude Code). A seção final do documento mostra como elas se encaixam.

---

## 1. Engenharia de Prompt e Definição de Papéis (Prompt Engineering & Role Prompting)

### O que é

Engenharia de prompt é a disciplina de projetar as instruções de entrada de um LLM (large language model) para maximizar a qualidade, previsibilidade e alinhamento das respostas com a tarefa desejada, sem alterar os pesos do modelo. Isso inclui técnicas como *few-shot prompting*, decomposição de raciocínio em passos intermediários (*chain-of-thought*) e a definição explícita de um **papel/persona** para o modelo assumir (ex.: "aja como um engenheiro de software sênior"), o que tende a restringir o espaço de respostas a um estilo e nível de rigor consistentes com esse papel.

Role prompting é particularmente relevante em sistemas multiagente: ao atribuir papéis distintos a diferentes instâncias de um LLM (ex.: "arquiteto", "revisor de código", "redator de documentação"), é possível especializar o comportamento de cada agente e estruturar a colaboração entre eles.

### Como aplicamos no TCC

- O arquivo `CLAUDE.md` na raiz do repositório é, na prática, um prompt de sistema persistente: define o papel do assistente ("engenheiro de software sênior e pesquisador"), os princípios arquiteturais do projeto (monólito modular, simplicidade) e restrições explícitas (o que está fora de escopo). Cada interação com o agente é condicionada por esse contexto.
- Definimos papéis diferentes para tarefas diferentes dentro da mesma sessão (ex.: "aja como pesquisador ao redigir a fundamentação teórica" vs. "aja como implementador ao escrever código de backend").
- Para a redação do TCC, podemos documentar de forma sistemática quais formulações de prompt (papel, restrições, poucos exemplos) produziram respostas mais alinhadas às boas práticas do projeto — isso vira dado empírico para o capítulo de metodologia/resultados.

### Referências

- Wei, J. et al. **Chain-of-Thought Prompting Elicits Reasoning in Large Language Models**. arXiv:2201.11903, 2022. Disponível em: https://arxiv.org/abs/2201.11903
- Sahoo, P. et al. **A Systematic Survey of Prompt Engineering in Large Language Models: Techniques and Applications**. arXiv:2402.07927, 2024. Disponível em: https://arxiv.org/abs/2402.07927
- Li, G. et al. **CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society**. NeurIPS 2023 / arXiv:2303.17760. Disponível em: https://arxiv.org/abs/2303.17760 (introduz *role-playing* e *inception prompting* para atribuição de papéis a agentes comunicativos)

---

## 2. Design de Skills/Ferramentas (Tool Use / Function Calling)

### O que é

LLMs têm conhecimento estático e não conseguem, por si só, executar ações no mundo real (rodar código, consultar um banco de dados, acessar a web). *Tool use* (ou *function calling*) é o mecanismo pelo qual um modelo decide, durante sua geração, invocar uma ferramenta externa — passando argumentos estruturados — e incorporar o resultado dessa chamada ao seu raciocínio subsequente. Uma "Skill", no sentido usado neste projeto, é uma ferramenta de escopo mais amplo que empacota conhecimento de domínio (quando usar, como usar, quais passos seguir) além da simples assinatura de função.

O design de boas ferramentas é um problema de engenharia por si só: nomes e descrições ambíguos levam a invocações incorretas; ferramentas com efeitos colaterais irreversíveis (deletar, fazer push) exigem salvaguardas adicionais.

### Como aplicamos no TCC

- No ambiente de desenvolvimento usado neste projeto (Claude Code), o agente tem acesso a ferramentas primitivas (leitura/edição de arquivos, execução de comandos shell, busca) e a Skills de mais alto nível (ex.: `code-review`, `security-review`, `verify`, `run`) que encapsulam fluxos de trabalho inteiros de engenharia de software.
- As Skills criadas ou customizadas especificamente para o domínio deste projeto, e a justificativa de cada decisão de design, estão documentadas em `docs/tecnicas-ia/skills.md` — incluindo a skill orquestradora `feature-pipeline`, que compõe o pipeline multiagente descrito em `docs/tecnicas-ia/subagents.md`.
- Isso conecta diretamente com um dos objetivos do TCC: avaliar como o *design de ferramentas* (não só o prompt) impacta a produtividade e a qualidade do código gerado.

### Referências

- Schick, T. et al. **Toolformer: Language Models Can Teach Themselves to Use Tools**. arXiv:2302.04761, 2023. Disponível em: https://arxiv.org/abs/2302.04761
- Yao, S. et al. **ReAct: Synergizing Reasoning and Acting in Language Models**. arXiv:2210.03629, 2022. Disponível em: https://arxiv.org/abs/2210.03629
- Qu, C. et al. **Tool Learning with Large Language Models: A Survey**. Frontiers of Computer Science, 19(8), 2025 / arXiv:2405.17935. Disponível em: https://arxiv.org/abs/2405.17935

---

## 3. Orquestração Multiagente (Multi-Agent Orchestration)

### O que é

Em vez de um único LLM tentando resolver uma tarefa complexa do início ao fim, sistemas multiagente decompõem o problema entre múltiplas instâncias de agentes, cada uma com um papel, contexto e conjunto de ferramentas especializados (ver Seção 1), coordenadas por algum mecanismo de orquestração (um agente "gerente" que delega subtarefas, ou um protocolo de conversação entre pares). Isso busca reduzir alucinações em cascata que ocorrem quando um único agente acumula contexto excessivo ou tenta manter coerência sobre uma tarefa muito longa, e permite paralelizar trabalho independente.

O custo é complexidade adicional: comunicação entre agentes, sincronização de estado e overhead de coordenação podem superar o ganho, especialmente em tarefas pequenas.

### Como aplicamos no TCC

- O ambiente de desenvolvimento oferece subagentes especializados (ex.: `Explore` para busca somente-leitura no código, `Plan` para desenho de estratégias de implementação, agentes de revisão de código) que podem ser delegados a partir de uma conversa principal.
- Para o TCC, o caso de uso mais honesto é: delegar pesquisa/exploração de código a um subagente enquanto a conversa principal mantém o contexto de decisão do usuário — isso evita que o contexto principal fique poluído com resultados intermediários de busca, mas só compensa a complexidade quando a tarefa é genuinamente grande ou paralelizável (algo a discutir criticamente no capítulo de metodologia, dado que o `CLAUDE.md` do projeto prioriza simplicidade).
- Cabe registrar como estudo de caso momentos em que a orquestração multiagente foi (ou não) vantajosa frente a uma abordagem de agente único, com métricas simples (tempo, número de correções necessárias, qualidade percebida).

### Subagents definidos no projeto

O projeto registra subagents de desenvolvimento em `docs/tecnicas-ia/subagents.md` e `.claude/agents/`. Esses subagents formalizam papeis recorrentes do processo: arquitetura de backend, modelagem de banco, revisao de codigo, documentacao e validacao. Eles sao ferramentas metodologicas de apoio ao desenvolvimento, nao funcionalidades do produto entregue aos usuarios finais.

### Referências

- Li, G. et al. **CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society**. arXiv:2303.17760, 2023. Disponível em: https://arxiv.org/abs/2303.17760
- Hong, S. et al. **MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework**. arXiv:2308.00352, 2023. Disponível em: https://arxiv.org/abs/2308.00352
- Wu, Q. et al. **AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation**. arXiv:2308.08155, 2023. Disponível em: https://arxiv.org/abs/2308.08155

---

## 4. Gerenciamento de Memória e Contexto (Memory & Context Engineering)

### O que é

LLMs operam com uma janela de contexto finita e, por padrão, não retêm nada entre sessões distintas. *Memory management* trata de como persistir, organizar e recuperar seletivamente informações relevantes entre interações (preferências do usuário, decisões de projeto já tomadas, fatos de domínio), de forma que o agente não precise redescobrir o mesmo contexto repetidamente nem sobrecarregar a janela de contexto ativa. *Context engineering* é o termo mais recente e amplo para o problema geral de decidir o que colocar dentro da janela de contexto do modelo a cada chamada (memórias recuperadas, resultados de ferramentas, histórico da conversa) para maximizar utilidade sem degradar desempenho por excesso de informação irrelevante ("context bloat").

### Como aplicamos no TCC

- Este próprio ambiente de desenvolvimento mantém um sistema de memória persistente em arquivos markdown, separado por tipo (perfil do usuário, feedback de colaboração, contexto de projeto, referências externas), que é consultado seletivamente em conversas futuras em vez de recarregar todo o histórico.
- Isso é diretamente instanciável como estudo de caso no TCC: registrar decisões de arquitetura já tomadas (ex.: "monólito modular", papéis do sistema) como memória de projeto evita que o agente proponha novamente alternativas já descartadas, e permite medir a redução de retrabalho/redundância nas sessões subsequentes.
- Um ponto crítico a documentar: memória persistente introduz risco de desatualização (uma decisão registrada pode deixar de valer); o próprio sistema aqui usado resolve isso verificando o estado atual do código antes de agir sobre uma memória — um padrão citável na literatura de "grounding" de memória.

### Referências

- Packer, C. et al. **MemGPT: Towards LLMs as Operating Systems**. arXiv:2310.08560, 2023. Disponível em: https://arxiv.org/abs/2310.08560
- Mei, L. et al. **A Survey of Context Engineering for Large Language Models**. arXiv:2507.13334, 2025. Disponível em: https://arxiv.org/abs/2507.13334

---

## 5. RAG — Retrieval-Augmented Generation

### O que é

RAG combina um LLM com um mecanismo de recuperação de informação: antes (ou durante) a geração da resposta, o sistema busca documentos relevantes em uma base externa (via busca vetorial/semântica ou lexical) e injeta esses trechos no prompt como contexto adicional. Isso reduz alucinação e permite que o modelo responda com base em informação atualizada ou específica de domínio que não estava (ou não estava correta) em seus pesos, sem precisar de re-treinamento.

### Como aplicamos no TCC

Aqui vale uma ressalva crítica, coerente com a diretriz de simplicidade do `CLAUDE.md`: para um repositório do porte deste projeto, ferramentas de busca direta no código (grep, leitura de arquivos) já cobrem boa parte do que RAG resolveria em bases muito maiores — construir um pipeline de indexação vetorial dedicado seria complexidade desproporcional ao benefício nesta escala, e não deve virar parte do produto entregue.

Onde RAG genuinamente se justifica neste TCC:

- **Apoio à redação do próprio TCC**: usar RAG sobre o corpus de artigos acadêmicos referenciados (os desta lista e outros levantados na revisão bibliográfica) para consultar e citar corretamente a literatura durante a escrita da fundamentação teórica — um uso de ferramenta de desenvolvimento/pesquisa, não uma funcionalidade do produto.
- **Grounding sobre documentação interna em crescimento**: à medida que `docs/` cresce (ADRs, decisões de arquitetura, este próprio documento), uma busca semântica leve sobre esses documentos pode ajudar o agente a manter respostas consistentes com decisões já registradas — mas somente se a base crescer a um ponto em que busca textual simples deixe de ser suficiente. Vale registrar essa decisão de *não* adotar RAG prematuramente como exemplo de "evitar complexidade sem valor proporcional", um dos critérios de julgamento técnico já adotados no projeto.

### Referências

- Lewis, P. et al. **Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks**. NeurIPS 2020 / arXiv:2005.11401. Disponível em: https://arxiv.org/abs/2005.11401 (artigo seminal que introduz a arquitetura RAG)
- Gao, Y. et al. **Retrieval-Augmented Generation for Large Language Models: A Survey**. arXiv:2312.10997, 2023. Disponível em: https://arxiv.org/abs/2312.10997

---

## Como as técnicas se relacionam

As cinco técnicas não competem entre si — compõem camadas de uma mesma arquitetura de agente:

1. **Prompt e papéis** definem *quem* o agente é e *como* ele deve se comportar em cada contexto.
2. **Skills/ferramentas** definem *o que* o agente pode fazer no mundo (ler/editar código, rodar testes, buscar na web).
3. **Orquestração multiagente** define *como dividir* uma tarefa grande entre múltiplos agentes especializados, cada um instanciando (1) e (2) de forma independente.
4. **Memória e contexto** definem *o que persiste* entre interações e *o que entra* na janela de contexto de cada chamada — o "cimento" que evita que (1), (2) e (3) percam coerência ao longo do tempo.
5. **RAG** é um caso especializado de (4) aplicado a bases de conhecimento externas e extensas, quando a memória interna do agente não é suficiente.

Essa estrutura em camadas é, em si, um argumento metodológico defensável para o TCC: em vez de tratar "usar IA no desenvolvimento" como uma escolha única, o trabalho pode documentar decisões independentes em cada camada e avaliar o impacto de cada uma isoladamente.

## Sugestão para a parte científica

Para transformar o uso dessas técnicas em dado científico (e não apenas em prática de desenvolvimento), recomenda-se manter um registro incremental — por exemplo `docs/diario-desenvolvimento.md` ou entradas versionadas — anotando, por técnica, quando foi aplicada, a decisão tomada e o resultado observado. Isso vira a matéria-prima direta para os capítulos de metodologia e resultados/discussão do TCC. Esse registro não foi criado ainda; avise se quiser que eu o estruture.

# Apoio Ferramental

Este documento registra as ferramentas de apoio ao desenvolvimento e à gestão do projeto — fora da stack de tecnologias do produto em si (ver documento de tecnologias) — e a justificativa de cada escolha.

## Ferramentas adotadas

| Categoria | Ferramenta | Justificativa |
|---|---|---|
| Controle de versão | **Git + GitHub** | Padrão de mercado, histórico versionado, base para revisão de código via Pull Requests. |
| Gestão de projeto | **Jira** (metodologia Scrum) | Organização do backlog (`user-stories.md`) em sprints, com rastreamento de progresso por prioridade (P0–P4). |
| Comunicação da equipe | **Telegram** | Comunicação assíncrona leve entre os dois membros da equipe. |
| Prototipação de interface | **Figma** | Prototipação visual das telas antes da implementação em Next.js. |
| Apoio de IA ao desenvolvimento | **Claude Code** | Agente de linha de comando usado no processo de desenvolvimento (implementação, revisão, documentação). Nomeado especificamente como *Claude Code* — e não apenas "IA" ou "Claude" — porque a parte científica do TCC investiga técnicas específicas desta ferramenta (engenharia de prompt, skills, orquestração multiagente, gerenciamento de memória/contexto — ver `docs/tecnicas-ia/`). |
| Integração contínua (CI) | **GitHub Actions** | Executa lint, checagem de tipos e (futuramente) testes automaticamente a cada Pull Request. Custo de configuração baixo por já estarmos no GitHub, e é um artefato citável no TCC como prática de integração contínua. |
| Diagramação de arquitetura | **Mermaid** | Usado para os diagramas do documento de modelagem e arquitetura (C4, DER, diagrama de módulos, etc.). Preferido a ferramentas externas (Lucidchart, draw.io) porque os diagramas ficam como texto versionado dentro do próprio `docs/`, renderizam nativamente no GitHub e não dependem de exportação de imagem ou conta externa. Figma permanece reservado para prototipação de UI, não para diagramas de arquitetura. |

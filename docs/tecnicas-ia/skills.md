# Skills no Projeto

## Objetivo

Skills são procedimentos/instruções especializados que o Claude Code carrega dentro da mesma conversa — diferente de um subagente (ver `docs/tecnicas-ia/subagents.md`), uma skill não roda em contexto isolado, ela orienta o agente que já está ativo sobre como executar uma tarefa específica.

Assim como os subagents, skills não fazem parte do produto final entregue a gestão, professores ou alunos. Pertencem ao processo de desenvolvimento e à parte metodológica do TCC — a técnica de "Design de Skills" documentada em `docs/tecnicas-ia/tecnicas-ia-engenharia-software.md`.

Tecnicamente, uma skill é uma pasta com um arquivo `SKILL.md` (frontmatter YAML com `name` e `description`, corpo em markdown com o procedimento), podendo incluir arquivos de apoio adicionais na mesma pasta. Não exige código nem infraestrutura nova.

## Skill criada no projeto: `feature-pipeline`

Arquivo: `.claude/skills/feature-pipeline/SKILL.md`.

É a skill orquestradora do pipeline completo de implementação de uma feature — a peça que aciona, em sequência, os 9 subagentes definidos em `.claude/agents/` (`plan-change`, `backend-architect`/`database-modeler`, `code-implementation`, `code-reviewer`, `test-writer`, `test-validator`, `pipeline-auditor`, `docs-writer`), repassando explicitamente o resultado de uma etapa como entrada da próxima.

Decisões de design registradas na própria skill, relevantes para o capítulo de metodologia do TCC:

- **Design é condicional**: só aciona `backend-architect`/`database-modeler` se o plano indicar impacto em múltiplos módulos ou no banco de dados — evita overhead de subagente para mudanças simples.
- **Auditoria final, não gate por etapa**: `pipeline-auditor` roda uma vez, ao final, comparando todas as etapas entre si — opção mais barata que rodar uma auditoria depois de cada etapa individual, mas que detecta erro mais tarde no processo. Essa é uma escolha explicitamente revisitável como experimento comparativo (ver `docs/tecnicas-ia/subagents.md`).
- **Implementação não é isolada do agente principal por padrão**: mesmo com `code-implementation` existindo como subagente, o uso da skill completa (delegando também a implementação) é tratado como uma escolha deliberada para fins de pesquisa — a implementação direta pelo agente principal, com contexto completo da conversa, tende a produzir resultado melhor no uso cotidiano. A skill existe para permitir comparar as duas abordagens, não para substituir a segunda por padrão.

## Skills nativas do Claude Code relevantes ao projeto

Além da skill criada, o Claude Code já traz skills prontas que se aplicam a este projeto sem precisar reconstruí-las:

| Skill | O que faz | Relevância para o projeto |
|---|---|---|
| `code-review` | Revisa o diff atual em busca de bugs de corretude e oportunidades de simplificação, em diferentes níveis de esforço | Sobreposição com o subagente `code-reviewer` — ver observação abaixo |
| `security-review` | Revisão de segurança das mudanças pendentes no branch atual | Relevante dado que o sistema lida com dado pessoal de aluno (LGPD) e autenticação via JWT — útil antes de PRs que tocam `users`/auth |
| `verify` | Roda a aplicação e observa o comportamento real para confirmar que uma mudança funciona, além de testes automatizados | Complementa `test-validator`: enquanto o subagente valida build/typecheck/rotas, esta skill verifica o comportamento na prática, rodando o app |
| `run` | Inicia e usa a aplicação do projeto para ver uma mudança funcionando | Útil para checagem manual rápida durante o desenvolvimento, fora do fluxo do pipeline completo |

### Observação: reaproveitamento não seguido à risca

Na discussão que motivou a criação dos subagentes de código (`code-reviewer`) e testes (`test-validator`), havia a intenção de **reaproveitar** as skills nativas `code-review` e `verify` em vez de reconstruir o critério do zero. Na prática, os subagentes `code-reviewer` e `test-validator` foram implementados como definições autocontidas, sem referenciar essas skills explicitamente.

Isso não é um erro a corrigir às pressas, mas é um dado metodológico relevante: mostra que a intenção de reaproveitamento nem sempre se sustenta na implementação — subagentes rodam em contexto isolado e não necessariamente "sabem" que uma skill do projeto existe, a menos que sejam instruídos a usá-la explicitamente. Fica como possível ajuste futuro (fazer `code-reviewer.md` instruir explicitamente o uso da skill `code-review`) e como ponto de discussão no capítulo de resultados sobre a técnica de Design de Skills.

## Registro para o TCC

Quando uma skill for usada em uma task relevante, registrar os mesmos dados já previstos para subagents em `docs/tecnicas-ia/subagents.md`: data aproximada, skill utilizada, objetivo, decisão resultante, evidência observável (PR, commit, arquivo alterado). Isso conecta o uso de skills à discussão sobre Design de Skills em `docs/tecnicas-ia/tecnicas-ia-engenharia-software.md`.

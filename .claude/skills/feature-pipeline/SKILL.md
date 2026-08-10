---
name: feature-pipeline
description: Orquestra o pipeline completo de implementação de uma feature ou mudança, coordenando os subagentes plan-change, backend-architect/database-modeler, code-implementation, code-reviewer, test-writer, test-validator e docs-writer em sequência. Use quando o usuário pedir para implementar uma feature/user story inteira, ou pedir explicitamente para rodar o pipeline automatizado de subagentes.
---

# Feature Pipeline

Orquestração multiagente de uma feature completa, do plano à documentação. Parte da pesquisa do TCC sobre orquestração multiagente (ver `docs/tecnicas-ia/tecnicas-ia-engenharia-software.md` e `docs/tecnicas-ia/subagents.md`).

## Quando usar

Use esta skill quando o usuário pedir para implementar uma feature/user story inteira (não um ajuste pequeno e pontual), ou pedir explicitamente para "rodar o pipeline" / "usar a orquestração de subagentes".

Para ajustes pequenos e óbvios, não use esta skill — implemente diretamente. O overhead de acionar 5+ subagentes só se justifica para mudanças com escopo real (nova entidade, novo endpoint, nova regra de negócio) e para o experimento de pesquisa do TCC (comparar pipeline delegado vs. implementação direta pelo agente principal).

## Fluxo

Execute as etapas abaixo em ordem, usando a ferramenta Agent para acionar cada subagente. Cada subagente roda em contexto isolado — sempre inclua explicitamente, no prompt de cada etapa, os resultados das etapas anteriores relevantes. O subagente não vê nada além do que for escrito no prompt dele.

1. **Plano** — Aciona `plan-change` com a descrição da feature/user story. Capture o plano retornado.

2. **Design (condicional)** — Leia o plano. Se ele indicar impacto em mais de um módulo do backend, aciona `backend-architect` com o plano. Se indicar impacto em entidade/relacionamento/schema do banco, aciona `database-modeler` com o plano. Os dois podem ser acionados em paralelo, se ambos forem necessários. Se a mudança for simples (um módulo só, sem impacto em banco), pule esta etapa.

3. **Implementação** — Aciona `code-implementation` com o plano e, se houver, o(s) resultado(s) da etapa de design. Capture os arquivos criados/alterados.

4. **Revisão de código** — Aciona `code-reviewer` com o diff resultante da etapa anterior.

5. **Escrita de testes** — Aciona `test-writer` com o plano e o código implementado.

6. **Validação** — Aciona `test-validator` para confirmar que build, typecheck e rotas continuam passando com a implementação e os testes novos.

7. **Auditoria** — Aciona `pipeline-auditor` com os resultados de todas as etapas anteriores (plano, design, implementação, revisão, testes, validação). É uma checagem independente, feita por um subagente que não participou da execução das etapas anteriores — não a mesma instância que orquestrou o pipeline avaliando o próprio trabalho.

8. **Documentação** — Aciona `docs-writer` com um resumo do que foi decidido e implementado nas etapas 1–7, incluindo o resultado da auditoria, para registrar em `docs/modelagem-e-arquitetura/` e, se cabível, como possível entrada de ADR.

## Ao final

Apresente ao usuário um resumo consolidado:

- O plano que guiou a mudança.
- Decisões de design tomadas (se houver).
- Arquivos implementados.
- Achados relevantes da revisão de código (mesmo os não corrigidos).
- Testes escritos e resultado da validação.
- O relatório de coerência produzido por `pipeline-auditor`, incluindo lacunas e contradições encontradas.
- O que foi documentado.

Se `pipeline-auditor` reportar uma etapa a ser refeita, pare e avise o usuário antes de considerar o pipeline concluído.

## Registro para o TCC

Ao final de uma execução completa do pipeline, sugerir ao usuário registrar a execução como estudo de caso (data, feature, subagentes acionados, tempo aproximado, resultado, inconsistências encontradas), conforme previsto na seção "Registro Para o TCC" de `docs/tecnicas-ia/subagents.md`. Isso transforma o uso do pipeline em dado comparável entre execuções, não apenas numa execução isolada.

## Limites

- Não substitui revisão humana do resultado final antes de merge.
- Não usar para tarefas triviais.
- Se um subagente retornar algo que contradiz uma decisão já registrada em `CLAUDE.md` ou `docs/modelagem-e-arquitetura/`, pare e avise o usuário antes de prosseguir para a próxima etapa.

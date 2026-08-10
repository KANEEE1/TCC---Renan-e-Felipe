---
name: code-implementation
description: Implementa uma mudança a partir de um plano e de um design já produzidos. Use depois que plan-change (e, quando aplicável, backend-architect/database-modeler) já definiram o que fazer, como etapa de execução de um pipeline de feature.
---

# code-implementation

## Papel

Subagente responsável por implementar uma mudança a partir de um plano e de um design já aprovados.

## Quando Usar

- Depois que `plan-change` e (quando aplicável) `backend-architect`/`database-modeler` já produziram plano e design.
- Ao executar a etapa de implementação de um pipeline de feature automatizado.

## Entradas Esperadas

- Plano de implementação produzido por `plan-change`.
- Recomendações de design de `backend-architect`/`database-modeler`, quando aplicável.
- Código atual dos arquivos a serem alterados.

## Saídas Esperadas

- Código implementado, seguindo o plano.
- Lista de arquivos criados ou alterados.
- Desvios do plano original, se houver, com justificativa.

## Critérios de Revisão

- Implementação segue a estrutura Controller → Service → Repository.
- Implementação não introduz abstrações além do que o plano previu.
- Implementação fica restrita ao escopo do plano, sem funcionalidade extra.
- Convenções do projeto são respeitadas (TypeScript, Zod para validação, nomenclatura de módulos já em uso).

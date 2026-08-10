---
name: plan-change
description: Produz o plano de implementação de uma mudança antes de qualquer código ser escrito. Use no início de uma nova feature ou mudança não-trivial, ou quando o escopo da tarefa não estiver claro o suficiente para implementar diretamente.
---

# plan-change

## Papel

Subagente responsável por produzir um plano de implementação para uma mudança, antes de qualquer código ser escrito.

## Quando Usar

- No início de uma nova feature ou mudança não-trivial.
- Quando o escopo da tarefa não está claro o suficiente para começar a implementar direto.
- Antes de acionar `backend-architect`/`database-modeler` para revisão de design.

## Entradas Esperadas

- Descrição da feature ou user story (referência a `docs/lista-features/user-stories.md`).
- Estado atual do código relevante (módulos existentes, schema).
- Decisões arquiteturais já registradas (`CLAUDE.md`, `docs/modelagem-e-arquitetura/`).

## Saídas Esperadas

- Lista de passos de implementação, em ordem.
- Arquivos que devem ser criados ou alterados.
- Dependências entre os passos.
- Riscos ou decisões em aberto que precisam de validação antes de prosseguir.

## Critérios de Revisão

- O plano está alinhado com a arquitetura já definida (monólito modular, Controller → Service → Repository).
- O plano não introduz escopo além do solicitado.
- O plano identifica se a mudança impacta banco de dados (sinaliza necessidade de `database-modeler`) ou mais de um módulo (sinaliza necessidade de `backend-architect`).
- O plano é específico o suficiente para orientar a implementação sem ambiguidade.

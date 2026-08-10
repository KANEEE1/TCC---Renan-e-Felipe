# Subagents no Projeto

## Objetivo

Os subagents sao perfis especializados usados durante o desenvolvimento assistido por IA. Eles ajudam a dividir tarefas complexas de engenharia de software em revisoes menores, com foco e criterio mais claros.

Eles nao fazem parte do produto final, nao sao funcionalidades da plataforma e nao sao acessados por gestao, professores ou alunos. Seu uso pertence ao processo de desenvolvimento e a parte metodologica do TCC.

## Subagents Definidos

| Subagent | Responsabilidade principal | Arquivo |
|---|---|---|
| `backend-architect` | Revisar arquitetura do backend, modulos e camadas | `.agents/backend-architect.md` |
| `database-modeler` | Revisar schema Prisma, DER, entidades e LGPD | `.agents/database-modeler.md` |
| `code-reviewer` | Revisar bugs, regressao, riscos e prontidao para PR | `.agents/code-reviewer.md` |
| `docs-writer` | Manter documentacao tecnica e academica sincronizada | `.agents/docs-writer.md` |
| `test-validator` | Validar build, typecheck, Prisma, banco e rotas | `.agents/test-validator.md` |

## Como Vamos Utilizar

1. Antes de implementar uma feature com impacto estrutural, consultar `backend-architect` ou `database-modeler`.
2. Durante mudancas no banco, usar `database-modeler` para validar entidades, relacionamentos e minimizacao de dados.
3. Depois da implementacao, usar `code-reviewer` para procurar riscos antes do PR.
4. Antes de abrir PR, usar `test-validator` para confirmar comandos, banco local e rotas principais.
5. Ao finalizar uma task relevante, usar `docs-writer` para atualizar documentacao e registrar decisoes do TCC.

## Exemplos de Uso

### Backend

Prompt de exemplo:

```text
Use o subagent backend-architect para revisar esta mudanca no backend.
Verifique se os modulos seguem Controller, Service e Repository e se existe algum acoplamento desnecessario.
```

### Banco de Dados

Prompt de exemplo:

```text
Use o subagent database-modeler para revisar este schema Prisma.
Confira se o DER esta sincronizado, se as relacoes fazem sentido e se ha risco de coletar dado pessoal desnecessario.
```

### Revisao de PR

Prompt de exemplo:

```text
Use o subagent code-reviewer para revisar o diff desta branch antes do PR.
Priorize bugs, riscos de regressao e validacoes faltantes.
```

### Validacao

Prompt de exemplo:

```text
Use o subagent test-validator para verificar se a branch esta pronta para PR.
Rode as validacoes cabiveis e informe qualquer limitacao.
```

### Documentacao

Prompt de exemplo:

```text
Use o subagent docs-writer para atualizar os documentos do TCC relacionados a esta mudanca.
Explique a decisao tomada, sua justificativa e suas limitacoes.
```

## Criterios de Uso

Subagents devem ser usados quando a tarefa for grande, ambigua ou envolver decisao arquitetural. Para ajustes pequenos, um unico agente principal e suficiente.

O uso de subagents deve ser proporcional ao risco da task. Uma mudanca simples de texto nao precisa passar por todos eles. Uma mudanca que altera banco, backend e documentacao deve passar por mais de um papel.

## Registro Para o TCC

Quando um subagent for usado em uma task relevante, registrar:

- Data aproximada da sessao.
- Subagent utilizado.
- Objetivo da consulta.
- Decisao ou ajuste resultante.
- Evidencia observavel, como PR, commit, arquivo alterado ou validacao executada.

Esse registro ajuda a transformar o uso de IA em dado metodologico, conectando o desenvolvimento do sistema a discussao sobre orquestracao multiagente em `docs/tecnicas-ia/tecnicas-ia-engenharia-software.md`.

## Limites

- Subagents nao substituem revisao humana.
- Subagents nao devem introduzir funcionalidades de IA no produto.
- Subagents nao devem ser usados para justificar complexidade desnecessaria.
- O agente principal continua responsavel por consolidar decisoes e verificar o estado real do repositorio.

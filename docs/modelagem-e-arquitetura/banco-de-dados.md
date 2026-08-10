# Definicao do Banco de Dados

Este documento representa visualmente o modelo de dados do sistema, com base nas decisoes registradas em `tecnologias.md`, `arquitetura-inicial.md` e `requisitos-nao-funcionais-e-lgpd.md`. Escopo: P0/P1 do backlog (`docs/lista-features/user-stories.md`), incluindo `Simulado`/`Nota` (P2), cujo dado de aluno ja foi confirmado como parte do escopo mesmo sem login de aluno.

O `schema.prisma` do backend e a fonte de verdade executavel; este diagrama deve ser mantido em sincronia com ele. Este e um documento vivo e sera refinado ao longo do desenvolvimento.

## Diagrama

```mermaid
erDiagram
    USER ||--o{ DISPONIBILIDADE : define
    USER ||--o{ AULA : leciona
    TURMA ||--o{ AULA : possui
    DISCIPLINA ||--o{ AULA : ministra
    TURMA ||--o{ MATRICULA : possui
    ALUNO ||--o{ MATRICULA : realiza
    ALUNO ||--o{ PRESENCA : possui
    AULA ||--o{ PRESENCA : registra
    ALUNO ||--o{ NOTA : recebe
    SIMULADO ||--o{ NOTA : gera

    USER {
        string id
        string name
        string email
        string celular
        string passwordHash
        string roles "lista - GESTAO e-ou PROFESSOR"
        datetime createdAt
        datetime updatedAt
    }

    ALUNO {
        string id
        string nome
        datetime createdAt
        datetime updatedAt
    }

    TURMA {
        string id
        string nome
        int anoLetivo
        datetime createdAt
        datetime updatedAt
    }

    DISCIPLINA {
        string id
        string nome
        datetime createdAt
        datetime updatedAt
    }

    DISPONIBILIDADE {
        string id
        string professorId
        string diaSemana
        time horarioInicio
        time horarioFim
        string periodoLetivo
        datetime createdAt
        datetime updatedAt
    }

    AULA {
        string id
        string turmaId
        string disciplinaId
        string professorId
        string diaSemana
        time horarioInicio
        time horarioFim
        datetime createdAt
        datetime updatedAt
    }

    MATRICULA {
        string id
        string alunoId
        string turmaId
        datetime dataMatricula
        datetime createdAt
        datetime updatedAt
    }

    PRESENCA {
        string id
        string alunoId
        string aulaId
        boolean presente
        datetime data
        datetime createdAt
        datetime updatedAt
    }

    SIMULADO {
        string id
        string nome
        datetime data
        datetime createdAt
        datetime updatedAt
    }

    NOTA {
        string id
        string alunoId
        string simuladoId
        float valor
        datetime createdAt
        datetime updatedAt
    }
```

## Notas de Design

- `User` representa gestao e/ou professor, nunca aluno. Aluno e entidade propria e mais enxuta (`Aluno`), sem `email`/`passwordHash`, porque nao autentica.
- `roles` e uma lista (`Role[]`), nao um valor unico. Permite um `User` acumular gestao e professor ao mesmo tempo, sem precisar de um terceiro valor de enum combinando os dois.
- `Disponibilidade` e `Aula` referenciam `User` via `professorId`. A regra "so um `User` com papel `PROFESSOR` pode ser `professorId`" e validada na camada de `Service`, nao no schema do banco.
- Horario usa campos simples (`diaSemana` + `horarioInicio` + `horarioFim`) em vez de entidade propria.
- `Simulado` e `Nota` sao entidades separadas. `Simulado` e o evento; `Nota` e o resultado, ligando `Aluno` + `Simulado`.
- `Nota` nao se relaciona com `Disciplina`, porque o simulado tem uma nota unica por aluno, nao quebrada por materia.
- `createdAt`/`updatedAt` existem em todas as entidades para depuracao, rastreio temporal e apoio a politica de retencao da LGPD.
- Auditoria de quem alterou presenca/nota segue como pendencia funcional futura, porque `updatedAt` informa quando algo mudou, mas nao quem mudou.

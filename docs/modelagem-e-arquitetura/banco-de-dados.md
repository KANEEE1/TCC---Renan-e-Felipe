# Definicao do Banco de Dados

O banco de dados do MVP segue o recorte P0/P1 do backlog: autenticacao de gestao/professores, cadastro academico basico, disponibilidade docente, grade horaria e presenca.

## Decisoes de Modelagem

- `User` representa apenas usuarios autenticados: gestao e professor.
- `Aluno` e uma entidade separada, sem senha, pois o aluno e titular de dado e nao acessa o sistema no MVP.
- `PeriodoLetivo` organiza matriculas, disponibilidade e aulas por ciclo academico.
- `Aula` representa uma aula recorrente da grade horaria.
- `Presenca` registra a ocorrencia de uma aula em uma data especifica para um aluno.
- Campos de auditoria aparecem onde sao mais relevantes para LGPD: aluno e presenca.

## Entidades

```mermaid
erDiagram
  User {
    string id PK
    string name
    string email UK
    string passwordHash
    UserRole role
    datetime createdAt
    datetime updatedAt
  }

  Aluno {
    string id PK
    string name
    StatusAluno status
    string createdById FK
    string updatedById FK
    datetime createdAt
    datetime updatedAt
  }

  Turma {
    string id PK
    string name UK
    string description
    datetime createdAt
    datetime updatedAt
  }

  Disciplina {
    string id PK
    string name UK
    string code UK
    datetime createdAt
    datetime updatedAt
  }

  PeriodoLetivo {
    string id PK
    string name UK
    date startsAt
    date endsAt
    boolean active
    datetime createdAt
    datetime updatedAt
  }

  Matricula {
    string id PK
    string alunoId FK
    string turmaId FK
    string periodoLetivoId FK
    StatusMatricula status
    datetime createdAt
    datetime updatedAt
  }

  ProfessorDisciplina {
    string id PK
    string professorId FK
    string disciplinaId FK
    datetime createdAt
  }

  Disponibilidade {
    string id PK
    string professorId FK
    string periodoLetivoId FK
    DiaSemana diaSemana
    string horaInicio
    string horaFim
    datetime createdAt
    datetime updatedAt
  }

  Aula {
    string id PK
    string turmaId FK
    string disciplinaId FK
    string professorId FK
    string periodoLetivoId FK
    DiaSemana diaSemana
    string horaInicio
    string horaFim
    string sala
    datetime createdAt
    datetime updatedAt
  }

  Presenca {
    string id PK
    string aulaId FK
    string alunoId FK
    string registradaPorId FK
    date data
    StatusPresenca status
    datetime createdAt
    datetime updatedAt
  }

  User ||--o{ ProfessorDisciplina : ministra
  User ||--o{ Disponibilidade : informa
  User ||--o{ Aula : ministra
  User ||--o{ Presenca : registra
  User ||--o{ Aluno : cria
  User ||--o{ Aluno : atualiza

  Aluno ||--o{ Matricula : possui
  Aluno ||--o{ Presenca : recebe

  Turma ||--o{ Matricula : contem
  Turma ||--o{ Aula : possui

  Disciplina ||--o{ ProfessorDisciplina : habilita
  Disciplina ||--o{ Aula : compoe

  PeriodoLetivo ||--o{ Matricula : organiza
  PeriodoLetivo ||--o{ Disponibilidade : recebe
  PeriodoLetivo ||--o{ Aula : organiza

  Aula ||--o{ Presenca : gera
```

## Regras Estruturais

- Um email de usuario deve ser unico.
- Uma matricula nao pode se repetir para o mesmo aluno, turma e periodo letivo.
- Um professor nao pode repetir a mesma disponibilidade no mesmo periodo, dia e horario.
- A mesma presenca nao pode ser registrada duas vezes para o mesmo aluno, aula e data.
- O mesmo professor nao deve ser associado duas vezes a mesma disciplina.

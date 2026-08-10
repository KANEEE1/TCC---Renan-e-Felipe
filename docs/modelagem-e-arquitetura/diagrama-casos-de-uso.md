# Diagrama de Casos de Uso

Este diagrama deriva das user stories em `docs/lista-features/user-stories.md` e considera o recorte P0/P1 como o primeiro incremento implementavel do sistema.

## Atores

- **Gestao**: usuario autenticado responsavel por cadastro, planejamento academico e administracao.
- **Professor**: usuario autenticado responsavel por disponibilidade, agenda e registro de presenca.
- **Aluno**: titular dos dados academicos, mas nao usuario autenticado no MVP. Interage com a organizacao fora da plataforma; seus dados sao gerenciados por gestao e professores.

## Diagrama

```mermaid
flowchart LR
  gestao["Ator: Gestao"]
  professor["Ator: Professor"]
  aluno["Ator externo: Aluno"]

  subgraph sistema["Plataforma de Gestao do Cursinho"]
    login["Realizar login"]
    manterPerfil["Atualizar proprio perfil"]
    manterAlunos["Cadastrar e editar alunos"]
    manterProfessores["Cadastrar e editar professores"]
    manterTurmas["Gerenciar turmas"]
    manterDisciplinas["Gerenciar disciplinas"]
    definirDisponibilidade["Definir disponibilidade"]
    visualizarAgenda["Visualizar agenda semanal"]
    visualizarCalendario["Visualizar calendario geral"]
    visualizarGrade["Visualizar grade por turma"]
    registrarPresenca["Registrar presenca"]
    gerenciarSimulados["Gerenciar simulados"]
    registrarNotas["Registrar notas de simulados"]
    solicitarCorrecao["Solicitar correcao de dados fora do sistema"]
  end

  gestao --> login
  professor --> login

  gestao --> manterPerfil
  professor --> manterPerfil

  gestao --> manterAlunos
  gestao --> manterProfessores
  gestao --> manterTurmas
  gestao --> manterDisciplinas
  gestao --> visualizarCalendario
  gestao --> visualizarGrade
  gestao --> gerenciarSimulados

  professor --> definirDisponibilidade
  professor --> visualizarAgenda
  professor --> registrarPresenca
  professor --> registrarNotas

  aluno -.-> solicitarCorrecao
  solicitarCorrecao -.-> manterAlunos
```

## Observacoes

- O aluno aparece como ator externo para preservar a discussao de LGPD, mas nao possui login nem credenciais.
- Funcionalidades P2-P4, como dashboard, eventos sazonais, notas de simulados, relatorios e professores substitutos, devem ser adicionadas em iteracoes posteriores.
- O diagrama evita incluir geracao automatica de grade horaria neste primeiro recorte, porque isso pertence a P2 e aumentaria a complexidade inicial.

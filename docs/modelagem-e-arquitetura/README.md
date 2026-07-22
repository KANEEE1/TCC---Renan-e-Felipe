# Modelagem e Arquitetura

Este documento lista todas as decisões e artefatos de modelagem e arquitetura previstos para o sistema até o final do projeto, e por que cada um importa tanto para a construção do sistema quanto para a redação do TCC.

---

## 1. Tecnologias

Stack completa por camada (linguagem, frontend, backend, banco de dados, ORM, validação, autenticação, autorização, testes) e alternativas descartadas. Ver [`tecnologias.md`](./tecnologias.md).

## 2. Apoio Ferramental

Ferramentas de apoio ao desenvolvimento e à gestão do projeto: versionamento, gestão de projeto, comunicação, prototipação, apoio de IA, integração contínua e diagramação. Ver [`apoio-ferramental.md`](./apoio-ferramental.md).

## 3. Arquitetura Inicial

Arquitetura em camadas no nível macro (front/back/data), organização do backend em módulos por domínio, e o padrão Controller → Service → Repository em POO usado dentro de cada módulo. Ver [`arquitetura-inicial.md`](./arquitetura-inicial.md).

## 4. Mapa de Empatia

Ferramenta de design thinking que organiza o que cada perfil de usuário (gestão, professor, aluno) pensa, sente, vê, ouve, fala e faz, além de suas dores e ganhos, ao lidar com o processo atual baseado em planilhas e mensagens. Complementa o backlog já levantado: enquanto as user stories descrevem *o que* cada perfil precisa fazer no sistema, o mapa de empatia investiga *por que* — as frustrações reais com o processo manual que justificam a construção da plataforma. Um mapa de empatia por perfil ajuda a validar se o backlog P0–P4 realmente endereça as dores identificadas, e é um artefato citável no capítulo de metodologia do TCC como evidência de levantamento de requisitos centrado no usuário.

## 5. Diagrama de Casos de Uso

Deriva diretamente das user stories já levantadas (`docs/lista-features/user-stories.md`), organizando-as por ator: gestão, professor e aluno. Conecta requisito a arquitetura de forma direta e é o ponto de partida natural do capítulo de modelagem do TCC.

## 6. Modelo de Domínio / Diagrama Entidade-Relacionamento (DER) - conclui

Entidades e relacionamentos do sistema, evoluindo por prioridade de backlog (P0/P1 primeiro). Entidades já identificadas a partir do backlog atual:

- `User` (com papel: gestão ou professor — aluno não autentica, é titular de dado gerenciado por esses dois papéis)
- `Aluno` (nome; sem credenciais de login)
- `Turma`
- `Disciplina`
- `Disponibilidade` (professor × período letivo)
- `Aula` (turma + disciplina + professor + horário — núcleo da grade horária)
- `Matricula` (aluno ↔ turma)
- `Presenca` (aluno × aula)

O `schema.prisma` do backend é a fonte de verdade executável; o DER é a representação visual usada na dissertação e deve ser mantido em sincronia com o schema.

## 7. Diagrama C4 — Contexto e Contêineres

Apenas os dois primeiros níveis do modelo C4 (Contexto e Contêineres — não é necessário chegar a Componentes/Código como diagramas formais separados, já que o diagrama de módulos cobre esse papel).

- **Contexto**: o sistema e os três perfis de usuário que interagem com ele.
- **Contêineres**: frontend, backend e banco de dados, e como se comunicam.

É a forma mais leve e atual de justificar visualmente a escolha por monólito modular em vez de microsserviços — decisão que deve estar explicitamente justificada na dissertação.

## 8. Diagrama de Módulos/Componentes do Backend

Mostra as fronteiras internas do monólito (ex.: `users`, `turmas`, `grade-horaria`, `disponibilidade`, `presenca`) e as dependências entre elas. Este é o artefato que dá substância real ao termo "modular" na descrição da arquitetura — sem ele, "monólito modular" permanece apenas uma frase, sem verificação prática das fronteiras.

## 9. Diagrama de Classes

Complementa o Diagrama de Módulos (item 8) num nível mais detalhado: mostra as classes reais de cada módulo (`TurmasController`, `TurmasService`, `TurmasRepository`), seus métodos e como se relacionam — algo que o DER não cobre, já que DER modela dados persistidos, não objetos com comportamento. Faz sentido agora que POO foi definida como estilo de implementação (ver `arquitetura-inicial.md`).

## 10. ADRs (Architecture Decision Records)

Registros curtos no formato contexto → decisão → consequências, um por decisão arquitetural relevante:

- Monólito modular vs. microsserviços
- Prisma como ORM
- Separação de módulos por domínio (em vez de apenas por camada técnica)
- Estratégia de autenticação/autorização

Este é o artefato de maior retorno para o TCC: ataca diretamente o critério de "decisões técnicas bem justificadas". Cada ADR pode registrar também se e como uma técnica de IA (engenharia de prompt, human-in-the-loop, etc. — ver `docs/tecnicas-ia/`) foi usada para se chegar à decisão, conectando este documento à parte científica do trabalho.

## 11. Requisitos Não-Funcionais e LGPD

O backlog atual (`user-stories.md`) cobre apenas requisitos funcionais. Como o sistema armazena dados pessoais de estudantes — possivelmente menores de idade — é necessário documentar requisitos não-funcionais com atenção explícita à LGPD (Lei Geral de Proteção de Dados): quem pode acessar dado de aluno, por quanto tempo é retido, e sob qual base legal. Este é um ponto frequentemente cobrado por bancas de TCC no Brasil.

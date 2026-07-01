# Arquitetura Inicial do Sistema

Este documento registra as decisões de arquitetura tomadas até o momento, com a justificativa de cada uma. Serve de base para os diagramas (C4, módulos) previstos em `README.md` desta pasta.

## 1. Visão macro: arquitetura em camadas (front / back / data)

O sistema é dividido em três peças independentes, cada uma rodando como sua própria aplicação/processo:

- **Frontend** (Next.js) — camada de apresentação, consome a API via HTTP.
- **Backend** (Express) — camada de aplicação/regras de negócio, expõe uma API.
- **Data** (PostgreSQL) — camada de dados.

Essa é uma arquitetura cliente-servidor clássica (3-tier), coerente com a separação `frontend/` e `backend/` já existente no repositório. Será representada no diagrama C4 de Contêineres (artefato ainda a produzir).

## 2. Organização do backend: módulos por domínio

Dentro do backend, o código é organizado em **módulos por domínio** (ex.: `turmas`, `disponibilidade`, `presenca`), em vez de pastas técnicas únicas e globais (`controllers/`, `services/`, `repositories/` para o backend inteiro).

**Por quê:** o `CLAUDE.md` do projeto define a arquitetura como "monólito modular". Pastas técnicas globais não expressam fronteira de domínio nenhuma — à medida que entidades como `User`, `Turma`, `Disciplina`, `Aula` e `Presenca` forem implementadas (backlog em `docs/lista-features/user-stories.md`), uma mudança em uma única funcionalidade passaria a tocar três pastas transversais, sem coesão visível. Organizar por módulo de domínio dá substância real ao termo "modular" e será representado no diagrama de módulos do backend (artefato ainda a produzir, em Mermaid).

Módulos previstos, com base no backlog P0/P1:

- `users` (autenticação e perfis: gestão, professor — aluno não faz login, é gerenciado por esses dois papéis)
- `turmas`
- `disciplinas`
- `disponibilidade`
- `grade-horaria` (aulas)
- `presenca`

## 3. Camadas técnicas dentro de cada módulo

Dentro de cada módulo, a lógica é organizada em três camadas técnicas: **Controller** (recebe a requisição HTTP) → **Service** (regra de negócio) → **Repository** (acesso a dados via Prisma).

**Nota de nomenclatura:** esse padrão não é chamado de MVC neste projeto, porque não existe uma View no backend — a "view" é o Next.js, uma aplicação inteiramente separada consumindo a API via HTTP. O nome correto para Controller → Service → Repository é **arquitetura em camadas** (N-tier), aplicada aqui no nível do módulo em vez de globalmente.

## 4. Estilo de implementação: Orientação a Objetos

Controller, Service e Repository são implementados como classes.

**Por quê:** decisão pela familiaridade da equipe com POO, favorecendo velocidade de desenvolvimento dentro do prazo acadêmico — critério explicitamente priorizado no `CLAUDE.md`. A alternativa (módulos funcionais com funções exportadas) foi considerada e traria menos boilerplate, mas foi descartada em favor do conforto da equipe com o paradigma já dominado.

### Composição sem container de injeção de dependência

Como o projeto não usa um framework com DI embutido (como o NestJS), a instanciação das classes de cada módulo é feita manualmente, uma única vez, e exportada como singleton — evitando reinstanciar a cada requisição:

```typescript
// turmas.repository.ts
export class TurmasRepository {
  constructor(private prisma: PrismaClient) {}
  async listar() { /* ... */ }
}

// turmas.service.ts
export class TurmasService {
  constructor(private repo: TurmasRepository) {}
  async criar(dados: CriarTurmaInput) { /* ... */ }
}

// turmas.module.ts — composição do módulo
import { prisma } from "../../shared/prisma";

export const turmasRepository = new TurmasRepository(prisma);
export const turmasService = new TurmasService(turmasRepository);

// turmas.controller.ts
import { turmasService } from "./turmas.module";
// usa turmasService diretamente nas rotas
```

## 5. Estrutura de pastas resultante

```
backend/src/modules/
  users/
    users.controller.ts
    users.service.ts
    users.repository.ts
    users.module.ts
  turmas/
    turmas.controller.ts
    turmas.service.ts
    turmas.repository.ts
    turmas.module.ts
  disponibilidade/
    ...
```

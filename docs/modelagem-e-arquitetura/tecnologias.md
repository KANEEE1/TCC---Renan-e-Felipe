# Tecnologias

Este documento registra as tecnologias adotadas no projeto e a justificativa de cada escolha, revisadas camada por camada.

## Resumo

- **Linguagem**: TypeScript de ponta a ponta — frontend e backend, sem JavaScript puro em nenhuma camada.
- **Frontend**: Next.js 15 (React 19) + Tailwind CSS v4
- **Backend**: Express 5, organizado em módulos por domínio, com Controller → Service → Repository em POO
- **Banco de dados**: PostgreSQL 16, acessado via Prisma 6
- **Validação**: Zod
- **Autenticação**: JWT customizado (`jsonwebtoken` + `bcrypt`) dentro do módulo `users`
- **Autorização**: middleware baseado em `role` (gestão/professor) — aluno é titular de dado, não usuário autenticado
- **Testes**: Vitest + Supertest

## Tecnologias adotadas

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | **Next.js 15** (React 19) + TypeScript | Mesmo sem depender de SSR (a área do sistema é toda logada, SEO não é relevante), o roteamento por arquivo e a estrutura pronta do Next.js economizam configuração para um time pequeno sob prazo acadêmico. |
| Estilização | **Tailwind CSS v4** | Já em uso; utilitário, sem necessidade de reavaliação. |
| Backend | **Express 5** | Mantido em vez de frameworks com injeção de dependência nativa (ex.: NestJS). Já está rodando no projeto, e o padrão de composição manual via singleton (ver `arquitetura-inicial.md`) resolve a necessidade de POO com DI sem o custo de aprendizado de um framework novo sob prazo apertado. |
| Banco de dados | **PostgreSQL 16** | Dado majoritariamente relacional (turmas, matrículas, aulas com restrição de horário). Mantém a porta aberta para a extensão `pgvector`, caso RAG venha a se justificar no futuro. |
| ORM | **Prisma 6** | Documentação madura e o **Prisma Studio** (GUI de inspeção de dados) é um ganho real para um time sem muita bagagem de DBA, além de facilitar a apresentação do modelo de dados na defesa do TCC. |
| Validação de dados | **Zod** | Valida o formato dos dados recebidos em runtime — necessário porque tipos do TypeScript não existem mais após a compilação e não protegem contra um JSON malformado vindo de fora. |
| Autenticação | **JWT customizado** (`jsonwebtoken` + `bcrypt`), implementado dentro do módulo `users` | Soluções como NextAuth/Auth.js pressupõem uma API dentro do próprio Next.js — não encaixam bem numa arquitetura com backend Express separado. JWT simples, emitido no login e validado por middleware, é a opção mais coerente com a arquitetura em módulos já definida (ver `arquitetura-inicial.md`), sem introduzir um framework de autenticação extra. |
| Autorização | **Middleware baseado em `role`** (gestão / professor) | Complementa a autenticação: decide o que cada perfil pode fazer (ex.: só a gestão pode cadastrar professores), mesmo com o usuário já autenticado. Aluno não é um papel autenticável — é titular de dado gerenciado por gestão/professor, sem login próprio (ver `requisitos-nao-funcionais-e-lgpd.md`). |
| Testes | **Vitest** (+ **Supertest** para rotas do backend) | Frontend e backend já usam `"type": "module"` nos respectivos `package.json` — Vitest tem suporte a ESM mais direto que Jest, com menos configuração. Supertest complementa para testar as rotas do Express de ponta a ponta. |


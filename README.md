# TCC Scheduler

Base mínima funcional com `frontend/` e `backend/` separados.

## Estrutura

- `frontend`: Next.js com TypeScript e Tailwind CSS
- `backend`: Node.js com Express e Prisma
- `docker-compose.yml`: PostgreSQL local

## Como rodar

1. `npm install`
2. `docker compose up -d`
3. `npm run dev`

## Teste rápido

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3333/health`

import type { Prisma, PrismaClient } from "@prisma/client";
import { diaSemanaOfDateOnly, parseDateOnly } from "../../shared/time.js";

type Db = PrismaClient | Prisma.TransactionClient;

export const excecaoSelect = {
  aulaId: true,
  dataOriginal: true,
  cancelada: true,
  data: true,
  horarioInicio: true,
  horarioFim: true,
  professorId: true,
  professor: { select: { id: true, name: true } }
} satisfies Prisma.AulaExcecaoSelect;

export const aulaOcorrivelSelect = {
  id: true,
  turmaId: true,
  disciplinaId: true,
  professorId: true,
  diaSemana: true,
  horarioInicio: true,
  horarioFim: true,
  createdAt: true,
  tipo: true,
  sala: true,
  turma: { select: { id: true, nome: true, gradeInicio: true, gradeFim: true } },
  disciplina: { select: { id: true, nome: true } },
  professor: { select: { id: true, name: true } }
} satisfies Prisma.AulaSelect;

// Fontes para gerar as ocorrências efetivas de um dia: as exceções que tocam a data (origem ou destino) e as aulas
// do dia da semana ou com alguma dessas exceções.
export async function carregarFontesDoDia(db: Db, data: string) {
  const dia = parseDateOnly(data);
  const excecoes = await db.aulaExcecao.findMany({
    where: { OR: [{ dataOriginal: dia }, { data: dia }] },
    select: excecaoSelect
  });
  const aulas = await db.aula.findMany({
    where: { OR: [{ diaSemana: diaSemanaOfDateOnly(data) }, { id: { in: excecoes.map((e) => e.aulaId) } }] },
    select: aulaOcorrivelSelect
  });
  return { aulas, excecoes };
}

// Exceções das aulas dadas que tocam datas em [de, ate] (origem ou destino).
export function carregarExcecoesDasAulas(db: Db, aulaIds: string[], de: string, ate: string) {
  const intervalo = { gte: parseDateOnly(de), lte: parseDateOnly(ate) };
  return db.aulaExcecao.findMany({
    where: { aulaId: { in: aulaIds }, OR: [{ dataOriginal: intervalo }, { data: intervalo }] },
    select: excecaoSelect
  });
}

import type { PrismaClient } from "@prisma/client";
import type { CreateNotaInput } from "./notas.schemas.js";

export class NotasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.nota.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        aluno: true,
        simulado: true
      }
    });
  }

  findTurmaById(id: string) {
    return this.prisma.turma.findUnique({ where: { id }, select: { id: true } });
  }

  listForClassSummary(turmaId: string) {
    return this.prisma.nota.findMany({
      where: {
        aluno: {
          matriculas: { some: { turmaId } }
        }
      },
      select: {
        valor: true,
        aluno: { select: { id: true, nome: true } },
        simulado: {
          select: {
            id: true,
            nome: true,
            data: true,
            disciplinaId: true,
            disciplina: { select: { id: true, nome: true } }
          }
        }
      }
    });
  }

  create(data: CreateNotaInput) {
    return this.prisma.nota.create({ data });
  }
}

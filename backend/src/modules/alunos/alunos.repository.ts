import type { PrismaClient } from "@prisma/client";
import type { CreateAlunoInput } from "./alunos.schemas.js";

export class AlunosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.aluno.findMany({
      orderBy: { name: "asc" },
      include: {
        matriculas: {
          include: {
            turma: true,
            periodoLetivo: true
          }
        }
      }
    });
  }

  create(data: CreateAlunoInput) {
    return this.prisma.aluno.create({ data });
  }
}

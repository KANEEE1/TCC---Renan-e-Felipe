import type { PrismaClient } from "@prisma/client";
import type { CreateMatriculaInput } from "./matriculas.schemas.js";
import { alunoAtivo } from "./vigencia.js";

export class MatriculasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.matricula.findMany({
      where: { aluno: alunoAtivo },
      orderBy: { createdAt: "desc" },
      include: {
        aluno: true,
        turma: true
      }
    });
  }

  create(data: CreateMatriculaInput) {
    return this.prisma.matricula.create({ data });
  }

  createMany(turmaId: string, alunoIds: string[]) {
    return this.prisma.matricula.createMany({
      data: alunoIds.map((alunoId) => ({ alunoId, turmaId })),
      skipDuplicates: true
    });
  }

  async algumRemovido(alunoIds: string[]) {
    return (await this.prisma.aluno.count({ where: { id: { in: alunoIds }, removidoEm: { not: null } } })) > 0;
  }

  listByTurma(turmaId: string) {
    return this.prisma.matricula.findMany({
      where: { turmaId, aluno: alunoAtivo },
      include: { aluno: true },
      orderBy: { createdAt: "desc" }
    });
  }
}

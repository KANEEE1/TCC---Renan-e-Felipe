import type { PrismaClient } from "@prisma/client";
import type { CreateTurmaInput, UpdateTurmaInput } from "./turmas.schemas.js";

export class TurmasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.turma.findMany({ orderBy: [{ anoLetivo: "desc" }, { nome: "asc" }] });
  }

  findById(id: string) {
    return this.prisma.turma.findUnique({
      where: { id },
      include: {
        matriculas: { include: { aluno: true } }
      }
    });
  }

  create(data: CreateTurmaInput) {
    return this.prisma.turma.create({ data });
  }

  update(id: string, data: UpdateTurmaInput) {
    return this.prisma.turma.update({ where: { id }, data });
  }
}

import type { PrismaClient } from "@prisma/client";
import type { CreateAlunoInput, UpdateAlunoInput } from "./alunos.schemas.js";

const alunoInclude = {
  matriculas: {
    include: { turma: true }
  },
  notas: {
    include: { simulado: true }
  },
  presencas: true
};

export class AlunosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.aluno.findMany({
      orderBy: { nome: "asc" },
      include: alunoInclude
    });
  }

  findById(id: string) {
    return this.prisma.aluno.findUnique({
      where: { id },
      include: alunoInclude
    });
  }

  create(data: CreateAlunoInput) {
    return this.prisma.aluno.create({ data });
  }

  update(id: string, data: UpdateAlunoInput) {
    return this.prisma.aluno.update({ where: { id }, data });
  }
}

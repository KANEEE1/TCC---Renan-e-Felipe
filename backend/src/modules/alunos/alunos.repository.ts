import type { PrismaClient } from "@prisma/client";
import type { CreateAlunoInput, UpdateAlunoInput } from "./alunos.schemas.js";

const alunoInclude = {
  matriculas: {
    include: { turma: true }
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

  // Aluno e matrícula na mesma escrita: não existe aluno sem turma.
  create({ turmaId, ...data }: CreateAlunoInput) {
    return this.prisma.aluno.create({ data: { ...data, matriculas: { create: { turmaId } } } });
  }

  async turmaExists(id: string) {
    return (await this.prisma.turma.count({ where: { id } })) > 0;
  }

  update(id: string, data: UpdateAlunoInput) {
    return this.prisma.aluno.update({ where: { id }, data });
  }
}

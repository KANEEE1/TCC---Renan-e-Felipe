import type { PrismaClient } from "@prisma/client";
import type { CreatePresencaInput, MarkAttendanceInput } from "./presenca.schemas.js";

const presencaInclude = {
  aluno: true,
  aula: {
    include: {
      turma: true,
      disciplina: true
    }
  }
};

export class PresencaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.presenca.findMany({
      orderBy: { data: "desc" },
      include: presencaInclude
    });
  }

  listByTurma(turmaId: string) {
    return this.prisma.presenca.findMany({
      where: { aula: { turmaId } },
      orderBy: { data: "desc" },
      include: presencaInclude
    });
  }

  listByAluno(alunoId: string) {
    return this.prisma.presenca.findMany({
      where: { alunoId },
      orderBy: { data: "desc" },
      include: presencaInclude
    });
  }

  create(data: CreatePresencaInput) {
    return this.prisma.presenca.create({ data, include: presencaInclude });
  }

  markBulk(input: MarkAttendanceInput) {
    return this.prisma.$transaction(
      input.entries.map((entry) =>
        this.prisma.presenca.upsert({
          where: {
            alunoId_aulaId_data: {
              alunoId: entry.alunoId,
              aulaId: input.aulaId,
              data: input.data
            }
          },
          create: {
            alunoId: entry.alunoId,
            aulaId: input.aulaId,
            data: input.data,
            presente: entry.presente
          },
          update: { presente: entry.presente },
          include: presencaInclude
        })
      )
    );
  }
}

import type { PrismaClient } from "@prisma/client";

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

  listMatriculasForSummary(turmaIds?: string[]) {
    return this.prisma.matricula.findMany({
      where: turmaIds ? { turmaId: { in: turmaIds } } : undefined,
      select: {
        alunoId: true,
        aluno: { select: { nome: true } },
        turma: { select: { id: true, nome: true } }
      }
    });
  }

  listPresencasForSummary(turmaIds?: string[]) {
    return this.prisma.presenca.findMany({
      where: turmaIds ? { aula: { turmaId: { in: turmaIds } } } : undefined,
      select: { alunoId: true, presente: true }
    });
  }

  findAulaForMark(aulaId: string) {
    return this.prisma.aula.findUnique({
      where: { id: aulaId },
      select: {
        id: true,
        professorId: true,
        diaSemana: true,
        horarioInicio: true,
        horarioFim: true,
        turma: {
          select: { id: true, gradeInicio: true, gradeFim: true, matriculas: { select: { alunoId: true } } }
        }
      }
    });
  }

  async hasAcceptedSubstitution(aulaId: string, substitutoId: string, data: Date) {
    const found = await this.prisma.substituicao.findFirst({
      where: { substitutoId, status: "ACEITA", ausencia: { aulaId, data } },
      select: { id: true }
    });
    return found !== null;
  }

  listAcceptedSubstitutionAulaIds(substitutoId: string, data: Date) {
    return this.prisma.substituicao
      .findMany({
        where: { substitutoId, status: "ACEITA", ausencia: { data } },
        select: { ausencia: { select: { aulaId: true } } }
      })
      .then((rows) => new Set(rows.map((r) => r.ausencia.aulaId)));
  }

  async listTurmaIdsOfAluno(alunoId: string) {
    const rows = await this.prisma.matricula.findMany({ where: { alunoId }, select: { turmaId: true } });
    return rows.map((r) => r.turmaId);
  }

  listAulasForConsolidation(turmaIds?: string[]) {
    return this.prisma.aula.findMany({
      where: turmaIds ? { turmaId: { in: turmaIds } } : undefined,
      select: {
        id: true,
        diaSemana: true,
        horarioFim: true,
        createdAt: true,
        turma: {
          select: { gradeInicio: true, gradeFim: true, matriculas: { select: { alunoId: true, dataMatricula: true, createdAt: true } } }
        }
      }
    });
  }

  listExistingPairs(aulaIds: string[], minData: Date) {
    return this.prisma.presenca.findMany({
      where: { aulaId: { in: aulaIds }, data: { gte: minData } },
      distinct: ["aulaId", "data"],
      select: { aulaId: true, data: true }
    });
  }

  createManyPresencas(rows: { alunoId: string; aulaId: string; data: Date; presente: boolean; automatica: boolean }[]) {
    return this.prisma.presenca.createMany({ data: rows, skipDuplicates: true });
  }

  listAulasDoDia(diaSemana: string) {
    return this.prisma.aula.findMany({
      where: { diaSemana },
      orderBy: { horarioInicio: "asc" },
      select: {
        id: true,
        professorId: true,
        diaSemana: true,
        horarioInicio: true,
        horarioFim: true,
        disciplina: { select: { id: true, nome: true } },
        turma: { select: { id: true, nome: true, gradeInicio: true, gradeFim: true } },
        professor: { select: { id: true, name: true } }
      }
    });
  }

  listPresencasDoDia(aulaIds: string[], data: Date) {
    return this.prisma.presenca.findMany({
      where: { aulaId: { in: aulaIds }, data },
      select: { aulaId: true, presente: true, automatica: true }
    });
  }

  markBulk(aulaId: string, data: Date, entries: { alunoId: string; presente: boolean }[]) {
    return this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.presenca.upsert({
          where: { alunoId_aulaId_data: { alunoId: entry.alunoId, aulaId, data } },
          create: { alunoId: entry.alunoId, aulaId, data, presente: entry.presente, automatica: false },
          update: { presente: entry.presente, automatica: false },
          include: presencaInclude
        })
      )
    );
  }
}

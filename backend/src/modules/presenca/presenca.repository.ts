import type { PrismaClient } from "@prisma/client";

const presencaInclude = {
  aluno: true,
  aula: {
    include: {
      turma: true,
      disciplina: true
    }
  },
  // Presença de evento (aula comum com presença): no lugar de `aula`.
  reuniao: { select: { id: true, titulo: true, disciplina: { select: { id: true, nome: true } } } },
  turma: { select: { id: true, nome: true } }
};

// Presenças das turmas dadas: as da grade (pela turma da aula) e as de evento (pela turma gravada).
const dasTurmas = (turmaIds: string[]) => ({ OR: [{ aula: { turmaId: { in: turmaIds } } }, { turmaId: { in: turmaIds } }] });

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
      where: dasTurmas([turmaId]),
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
      where: turmaIds ? dasTurmas(turmaIds) : undefined,
      select: { alunoId: true, presente: true }
    });
  }

  findAulaForMark(aulaId: string) {
    return this.prisma.aula.findUnique({
      where: { id: aulaId },
      select: {
        id: true,
        turmaId: true,
        disciplinaId: true,
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

  // Substituições aceitas do usuário nas ocorrências dadas (chave "aulaId|YYYY-MM-DD" da data original).
  async listAcceptedSubstitutionKeys(substitutoId: string, ocorrencias: { aulaId: string; dataOriginal: Date }[]) {
    if (ocorrencias.length === 0) return new Set<string>();
    const rows = await this.prisma.substituicao.findMany({
      where: {
        substitutoId,
        status: "ACEITA",
        ausencia: { OR: ocorrencias.map(({ aulaId, dataOriginal }) => ({ aulaId, data: dataOriginal })) }
      },
      select: { ausencia: { select: { aulaId: true, data: true } } }
    });
    return new Set(rows.map((r) => `${r.ausencia.aulaId}|${r.ausencia.data.toISOString().slice(0, 10)}`));
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
        turmaId: true,
        disciplinaId: true,
        professorId: true,
        diaSemana: true,
        horarioInicio: true,
        horarioFim: true,
        createdAt: true,
        turma: {
          select: { gradeInicio: true, gradeFim: true, matriculas: { select: { alunoId: true, dataMatricula: true, createdAt: true } } }
        }
      }
    });
  }

  // Eventos com presença entre `de` e `ate` (datas) que ainda não têm nenhum registro, com os matriculados das turmas.
  listEventosForConsolidation(de: Date, ate: Date, turmaIds?: string[]) {
    return this.prisma.reuniao.findMany({
      where: { exigePresenca: true, data: { gte: de, lte: ate }, presencas: { none: {} }, ...(turmaIds ? { turmas: { some: { id: { in: turmaIds } } } } : {}) },
      select: {
        id: true,
        data: true,
        horarioInicio: true,
        horarioFim: true,
        createdAt: true,
        turmas: {
          select: { id: true, matriculas: { select: { alunoId: true, dataMatricula: true, createdAt: true } } },
          orderBy: { nome: "asc" }
        }
      }
    });
  }

  findEventoForMark(id: string) {
    return this.prisma.reuniao.findUnique({
      where: { id },
      select: {
        id: true,
        exigePresenca: true,
        data: true,
        horarioInicio: true,
        horarioFim: true,
        participacoes: { select: { userId: true } },
        turmas: {
          select: { id: true, matriculas: { select: { alunoId: true, dataMatricula: true, createdAt: true } } },
          orderBy: { nome: "asc" }
        }
      }
    });
  }

  listEventosDoDia(data: Date) {
    return this.prisma.reuniao.findMany({
      where: { exigePresenca: true, data },
      orderBy: { horarioInicio: "asc" },
      select: {
        id: true,
        titulo: true,
        horarioInicio: true,
        horarioFim: true,
        disciplina: { select: { id: true, nome: true } },
        turmas: { select: { id: true, nome: true }, orderBy: { nome: "asc" } },
        participacoes: { select: { user: { select: { id: true, name: true } } } },
        presencas: { select: { presente: true, automatica: true } }
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

  createManyPresencas(
    rows: { alunoId: string; aulaId?: string; reuniaoId?: string; turmaId?: string; data: Date; presente: boolean; automatica: boolean }[]
  ) {
    return this.prisma.presenca.createMany({ data: rows, skipDuplicates: true });
  }

  listPresencasDasOcorrencias(ocorrencias: { aulaId: string; dataOriginal: Date }[]) {
    if (ocorrencias.length === 0) return Promise.resolve([]);
    return this.prisma.presenca.findMany({
      where: { OR: ocorrencias.map(({ aulaId, dataOriginal }) => ({ aulaId, data: dataOriginal })) },
      select: { aulaId: true, data: true, presente: true, automatica: true }
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

  markEventoBulk(reuniaoId: string, data: Date, entries: { alunoId: string; turmaId: string; presente: boolean }[]) {
    return this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.presenca.upsert({
          where: { alunoId_reuniaoId: { alunoId: entry.alunoId, reuniaoId } },
          create: { alunoId: entry.alunoId, reuniaoId, turmaId: entry.turmaId, data, presente: entry.presente, automatica: false },
          update: { presente: entry.presente, automatica: false },
          include: presencaInclude
        })
      )
    );
  }
}

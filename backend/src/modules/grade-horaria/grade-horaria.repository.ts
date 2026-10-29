import { Prisma, type PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateAulaInput, UpdateAulaInput } from "./grade-horaria.schemas.js";
import { aulaOcorrivelSelect, carregarExcecoesDasAulas, carregarFontesDoDia, excecaoSelect } from "./ocorrencias.db.js";

const aulaInclude = {
  turma: true,
  disciplina: true,
  professor: {
    select: {
      id: true,
      name: true
    }
  }
};

const aulaComExcecoesInclude = {
  ...aulaInclude,
  excecoes: { select: excecaoSelect, orderBy: { dataOriginal: "asc" } }
} satisfies Prisma.AulaInclude;

export class GradeHorariaRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Prisma.TransactionClient | PrismaClient = prisma
  ) {}

  transaction<T>(fn: (repository: GradeHorariaRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new GradeHorariaRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  findTurma(id: string) {
    return this.db.turma.findUnique({ where: { id }, select: { id: true, gradeInicio: true, gradeFim: true } });
  }

  listCargasDaTurma(turmaId: string) {
    return this.db.cargaDisciplinaTurma.findMany({
      where: { turmaId },
      include: { disciplina: { select: { id: true, nome: true } } }
    });
  }

  listJanelasDaTurma(turmaId: string) {
    return this.db.janelaTurma.findMany({ where: { turmaId } });
  }

  listProfessoresAtivosDasDisciplinas(disciplinaIds: string[], excluidos: string[]) {
    return this.db.user.findMany({
      where: {
        ativo: true,
        roles: { has: "PROFESSOR" },
        id: { notIn: excluidos },
        disciplinas: { some: { id: { in: disciplinaIds } } }
      },
      select: { id: true, name: true, disciplinas: { select: { id: true } } }
    });
  }

  listDisponibilidadesDosProfessores(professorIds: string[]) {
    return this.db.disponibilidade.findMany({ where: { professorId: { in: professorIds } } });
  }

  listAulasDosProfessoresForaDaTurma(professorIds: string[], turmaId: string) {
    return this.db.aula.findMany({ where: { professorId: { in: professorIds }, turmaId: { not: turmaId } } });
  }

  countAulasDaTurma(turmaId: string) {
    return this.db.aula.count({ where: { turmaId } });
  }

  countAulasComRegistro(turmaId: string) {
    return this.db.aula.count({
      where: { turmaId, OR: [{ presencas: { some: {} } }, { ausencias: { some: {} } }] }
    });
  }

  async replaceAulasDaTurma(turmaId: string, aulas: Omit<CreateAulaInput, "turmaId">[]) {
    await this.db.aula.deleteMany({ where: { turmaId } });
    const { count } = await this.db.aula.createMany({
      data: aulas.map((aula) => ({
        ...aula,
        turmaId,
        horarioInicio: parseTimeToDate(aula.horarioInicio),
        horarioFim: parseTimeToDate(aula.horarioFim)
      }))
    });
    return count;
  }

  list() {
    return this.prisma.aula.findMany({
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: aulaComExcecoesInclude
    });
  }

  findById(id: string) {
    return this.prisma.aula.findUnique({ where: { id }, include: aulaInclude });
  }

  listByTurma(turmaId: string) {
    return this.prisma.aula.findMany({
      where: { turmaId },
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: aulaComExcecoesInclude
    });
  }

  listByProfessor(professorId: string) {
    return this.prisma.aula.findMany({
      where: { professorId },
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: { turma: true, disciplina: true }
    });
  }

  listForConflicts(professorIds: string[], turmaIds: string[]) {
    return this.prisma.aula.findMany({
      where: { OR: [{ professorId: { in: professorIds } }, { turmaId: { in: turmaIds } }] }
    });
  }

  listCargas(pares: { turmaId: string; disciplinaId: string }[]) {
    return this.prisma.cargaDisciplinaTurma.findMany({
      where: { OR: pares.map(({ turmaId, disciplinaId }) => ({ turmaId, disciplinaId })) }
    });
  }

  createMany(data: CreateAulaInput[]) {
    return this.prisma.$transaction(
      data.map((item) =>
        this.prisma.aula.create({
          data: {
            ...item,
            horarioInicio: parseTimeToDate(item.horarioInicio),
            horarioFim: parseTimeToDate(item.horarioFim)
          },
          include: aulaInclude
        })
      )
    );
  }

  create(data: CreateAulaInput) {
    return this.prisma.aula.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim)
      },
      include: aulaInclude
    });
  }

  update(id: string, data: UpdateAulaInput) {
    return this.prisma.aula.update({
      where: { id },
      data: {
        ...data,
        horarioInicio: data.horarioInicio ? parseTimeToDate(data.horarioInicio) : undefined,
        horarioFim: data.horarioFim ? parseTimeToDate(data.horarioFim) : undefined
      },
      include: aulaInclude
    });
  }

  remove(id: string) {
    return this.prisma.aula.delete({ where: { id } });
  }

  // --- Ocorrências (exceções de uma única data da série) ---

  findAulaParaOcorrencia(id: string) {
    return this.db.aula.findUnique({ where: { id }, select: aulaOcorrivelSelect });
  }

  findExcecao(aulaId: string, dataOriginal: Date) {
    return this.db.aulaExcecao.findUnique({
      where: { aulaId_dataOriginal: { aulaId, dataOriginal } },
      select: excecaoSelect
    });
  }

  findProfessor(id: string) {
    return this.db.user.findUnique({ where: { id }, select: { id: true, name: true, ativo: true, roles: true } });
  }

  carregarFontesDoDia(data: string) {
    return carregarFontesDoDia(this.db, data);
  }

  carregarExcecoesDasAulas(aulaIds: string[], de: string, ate: string) {
    return carregarExcecoesDasAulas(this.db, aulaIds, de, ate);
  }

  countPresencasManuais(aulaId: string, data: Date) {
    return this.db.presenca.count({ where: { aulaId, data, automatica: false } });
  }

  countPresencas(aulaId: string, data: Date) {
    return this.db.presenca.count({ where: { aulaId, data } });
  }

  countAusencias(aulaId: string, data: Date) {
    return this.db.ausenciaAula.count({ where: { aulaId, data } });
  }

  countSubstituicoesAceitas(aulaId: string, data: Date) {
    return this.db.substituicao.count({ where: { status: "ACEITA", ausencia: { aulaId, data } } });
  }

  // Exceções não canceladas de OUTRAS aulas, com data efetiva a partir de `desde`, do professor ou da turma.
  listExcecoesDeOutrasAulas(aulaId: string, professorId: string, turmaId: string, desde: Date) {
    return this.db.aulaExcecao.findMany({
      where: {
        aulaId: { not: aulaId },
        cancelada: false,
        data: { gte: desde },
        OR: [{ professorId }, { aula: { turmaId } }]
      },
      select: { data: true, horarioInicio: true, horarioFim: true, professorId: true, aula: { select: { turmaId: true } } }
    });
  }

  upsertExcecao(
    aulaId: string,
    dataOriginal: Date,
    data: { cancelada: boolean; data: Date | null; horarioInicio: Date | null; horarioFim: Date | null; professorId: string | null }
  ) {
    return this.db.aulaExcecao.upsert({
      where: { aulaId_dataOriginal: { aulaId, dataOriginal } },
      create: { aulaId, dataOriginal, ...data },
      update: data,
      select: excecaoSelect
    });
  }

  // Cancelar uma ocorrência: some o que dependia dela (presença automática, falta e substituições daquela data).
  async limparRegistrosDaOcorrencia(aulaId: string, data: Date) {
    await this.db.presenca.deleteMany({ where: { aulaId, data, automatica: true } });
    const ausencias = await this.db.ausenciaAula.findMany({ where: { aulaId, data }, select: { id: true } });
    const ids = ausencias.map((a) => a.id);
    await this.db.substituicao.deleteMany({ where: { ausenciaId: { in: ids } } });
    await this.db.ausenciaAula.deleteMany({ where: { id: { in: ids } } });
  }
}

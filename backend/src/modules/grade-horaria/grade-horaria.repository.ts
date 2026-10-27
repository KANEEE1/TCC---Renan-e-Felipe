import { Prisma, type PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateAulaInput, UpdateAulaInput } from "./grade-horaria.schemas.js";

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
      include: aulaInclude
    });
  }

  findById(id: string) {
    return this.prisma.aula.findUnique({ where: { id }, include: aulaInclude });
  }

  listByTurma(turmaId: string) {
    return this.prisma.aula.findMany({
      where: { turmaId },
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: aulaInclude
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
}

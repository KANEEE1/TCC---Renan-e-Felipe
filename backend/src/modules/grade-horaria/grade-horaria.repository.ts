import type { PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateAulaInput, UpdateAulaInput } from "./grade-horaria.schemas.js";

const aulaInclude = {
  turma: true,
  disciplina: true,
  professor: {
    select: {
      id: true,
      name: true,
      email: true,
      roles: true
    }
  }
};

export class GradeHorariaRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

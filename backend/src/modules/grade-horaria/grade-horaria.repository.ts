import type { PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateAulaInput } from "./grade-horaria.schemas.js";

export class GradeHorariaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.aula.findMany({
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: {
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
      }
    });
  }

  create(data: CreateAulaInput) {
    return this.prisma.aula.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim)
      }
    });
  }
}

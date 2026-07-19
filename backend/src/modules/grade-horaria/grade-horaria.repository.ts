import type { PrismaClient } from "@prisma/client";
import type { CreateAulaInput } from "./grade-horaria.schemas.js";

export class GradeHorariaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.aula.findMany({
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      include: {
        turma: true,
        disciplina: true,
        periodoLetivo: true,
        professor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
  }

  create(data: CreateAulaInput) {
    return this.prisma.aula.create({ data });
  }
}

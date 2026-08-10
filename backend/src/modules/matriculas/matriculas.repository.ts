import type { PrismaClient } from "@prisma/client";
import type { CreateMatriculaInput } from "./matriculas.schemas.js";

export class MatriculasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.matricula.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        aluno: true,
        turma: true
      }
    });
  }

  create(data: CreateMatriculaInput) {
    return this.prisma.matricula.create({ data });
  }
}

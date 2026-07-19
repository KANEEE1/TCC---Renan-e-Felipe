import type { PrismaClient } from "@prisma/client";
import type { CreateDisciplinaInput } from "./disciplinas.schemas.js";

export class DisciplinasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.disciplina.findMany({ orderBy: { name: "asc" } });
  }

  create(data: CreateDisciplinaInput) {
    return this.prisma.disciplina.create({ data });
  }
}

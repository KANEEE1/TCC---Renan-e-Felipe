import type { PrismaClient } from "@prisma/client";
import type { CreateTurmaInput } from "./turmas.schemas.js";

export class TurmasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.turma.findMany({ orderBy: [{ anoLetivo: "desc" }, { nome: "asc" }] });
  }

  create(data: CreateTurmaInput) {
    return this.prisma.turma.create({ data });
  }
}

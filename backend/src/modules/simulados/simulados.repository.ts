import type { PrismaClient } from "@prisma/client";
import type { CreateSimuladoInput } from "./simulados.schemas.js";

export class SimuladosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.simulado.findMany({
      orderBy: { data: "desc" },
      include: {
        disciplina: true,
        notas: { include: { aluno: true } }
      }
    });
  }

  create(data: CreateSimuladoInput) {
    return this.prisma.simulado.create({ data });
  }
}

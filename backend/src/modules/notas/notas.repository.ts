import type { PrismaClient } from "@prisma/client";
import type { CreateNotaInput } from "./notas.schemas.js";

export class NotasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.nota.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        aluno: true,
        simulado: true
      }
    });
  }

  create(data: CreateNotaInput) {
    return this.prisma.nota.create({ data });
  }
}

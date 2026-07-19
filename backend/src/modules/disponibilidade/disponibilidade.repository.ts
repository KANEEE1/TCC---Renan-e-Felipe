import type { PrismaClient } from "@prisma/client";
import type { CreateDisponibilidadeInput } from "./disponibilidade.schemas.js";

export class DisponibilidadeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.disponibilidade.findMany({
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      include: {
        professor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        periodoLetivo: true
      }
    });
  }

  create(data: CreateDisponibilidadeInput) {
    return this.prisma.disponibilidade.create({ data });
  }
}

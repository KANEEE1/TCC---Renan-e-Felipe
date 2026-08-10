import type { PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateDisponibilidadeInput } from "./disponibilidade.schemas.js";

export class DisponibilidadeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.disponibilidade.findMany({
      orderBy: [{ diaSemana: "asc" }, { horarioInicio: "asc" }],
      include: {
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

  create(data: CreateDisponibilidadeInput) {
    return this.prisma.disponibilidade.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim)
      }
    });
  }
}

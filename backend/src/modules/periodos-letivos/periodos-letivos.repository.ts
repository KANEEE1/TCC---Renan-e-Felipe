import type { PrismaClient } from "@prisma/client";
import type { CreatePeriodoLetivoInput } from "./periodos-letivos.schemas.js";

export class PeriodosLetivosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.periodoLetivo.findMany({ orderBy: { startsAt: "desc" } });
  }

  create(data: CreatePeriodoLetivoInput) {
    return this.prisma.periodoLetivo.create({ data });
  }
}

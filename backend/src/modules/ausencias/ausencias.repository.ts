import type { PrismaClient } from "@prisma/client";
import { parseDateOnly } from "../../shared/time.js";

const ausenciaInclude = {
  aula: {
    include: {
      turma: { select: { id: true, nome: true } },
      disciplina: { select: { id: true, nome: true } },
      professor: { select: { id: true, name: true } }
    }
  },
  registradoPor: { select: { id: true, name: true } }
} as const;

export class AusenciasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAulaById(id: string) {
    return this.prisma.aula.findUnique({ where: { id }, select: { id: true, professorId: true, diaSemana: true } });
  }

  async list(filters: { de?: string; ate?: string; registradoPorId?: string }) {
    const ausencias = await this.prisma.ausenciaAula.findMany({
      where: {
        registradoPorId: filters.registradoPorId,
        data: {
          gte: filters.de ? parseDateOnly(filters.de) : undefined,
          lte: filters.ate ? parseDateOnly(filters.ate) : undefined
        }
      },
      include: ausenciaInclude
    });

    return ausencias.sort(
      (a, b) => a.data.getTime() - b.data.getTime() || a.aula.horarioInicio.getTime() - b.aula.horarioInicio.getTime()
    );
  }

  findById(id: string) {
    return this.prisma.ausenciaAula.findUnique({ where: { id }, include: ausenciaInclude });
  }

  create(data: { aulaId: string; data: string; motivo?: string }, registradoPorId: string) {
    return this.prisma.ausenciaAula.create({
      data: { ...data, data: parseDateOnly(data.data), registradoPorId },
      include: ausenciaInclude
    });
  }

  remove(id: string) {
    return this.prisma.ausenciaAula.delete({ where: { id } });
  }
}

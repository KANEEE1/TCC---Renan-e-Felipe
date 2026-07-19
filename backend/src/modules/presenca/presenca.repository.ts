import type { PrismaClient } from "@prisma/client";
import type { CreatePresencaInput } from "./presenca.schemas.js";

export class PresencaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.presenca.findMany({
      orderBy: { data: "desc" },
      include: {
        aluno: true,
        aula: {
          include: {
            turma: true,
            disciplina: true
          }
        },
        registradaPor: {
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

  create(data: CreatePresencaInput) {
    return this.prisma.presenca.create({ data });
  }
}

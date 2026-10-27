import type { PrismaClient } from "@prisma/client";

export class DisciplinasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.disciplina.findMany({ orderBy: { nome: "asc" } });
  }

  findById(id: string) {
    return this.prisma.disciplina.findUnique({ where: { id } });
  }

  listByNomesNormalizados(nomesNormalizados: string[]) {
    return this.prisma.disciplina.findMany({ where: { nomeNormalizado: { in: nomesNormalizados } } });
  }

  countProfessores(id: string) {
    return this.prisma.user.count({ where: { disciplinas: { some: { id } } } });
  }

  create(data: { nome: string; nomeNormalizado: string }) {
    return this.prisma.disciplina.create({ data });
  }

  createMany(data: { nome: string; nomeNormalizado: string }[]) {
    return this.prisma.disciplina.createMany({ data, skipDuplicates: true });
  }

  update(id: string, data: { nome: string; nomeNormalizado: string }) {
    return this.prisma.disciplina.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.disciplina.delete({ where: { id } });
  }
}

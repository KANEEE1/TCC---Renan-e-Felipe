import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type TurmaData = Omit<Prisma.TurmaUncheckedCreateInput, "id">;

export interface LinhaMatriz {
  disciplinaId: string;
  aulasPorSemana: number;
  duracaoMinutos: number;
}

const cargasInclude = {
  cargas: {
    select: {
      id: true,
      aulasPorSemana: true,
      duracaoMinutos: true,
      disciplina: { select: { id: true, nome: true } }
    },
    orderBy: { disciplina: { nome: "asc" } }
  }
} satisfies Prisma.TurmaInclude;

export class TurmasRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Db = prisma
  ) {}

  transaction<T>(fn: (repository: TurmasRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new TurmasRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  list() {
    return this.db.turma.findMany({
      orderBy: [{ anoLetivo: "desc" }, { nome: "asc" }],
      include: cargasInclude
    });
  }

  findById(id: string) {
    return this.db.turma.findUnique({
      where: { id },
      include: {
        matriculas: { include: { aluno: true } },
        ...cargasInclude
      }
    });
  }

  create(data: TurmaData) {
    return this.db.turma.create({ data });
  }

  update(id: string, data: Partial<TurmaData>) {
    return this.db.turma.update({ where: { id }, data });
  }

  findDisciplinaById(id: string) {
    return this.db.disciplina.findUnique({ where: { id } });
  }

  findDisciplinaPorNomeNormalizado(nomeNormalizado: string) {
    return this.db.disciplina.findUnique({ where: { nomeNormalizado } });
  }

  criarDisciplina(data: { nome: string; nomeNormalizado: string }) {
    return this.db.disciplina.create({ data });
  }

  async substituirMatriz(turmaId: string, linhas: LinhaMatriz[]) {
    await this.db.cargaDisciplinaTurma.deleteMany({ where: { turmaId } });
    await this.db.cargaDisciplinaTurma.createMany({ data: linhas.map((linha) => ({ ...linha, turmaId })) });
  }
}

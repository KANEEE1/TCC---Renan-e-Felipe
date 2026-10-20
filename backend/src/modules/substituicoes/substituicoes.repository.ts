import { Prisma, type PrismaClient, type StatusSubstituicao } from "@prisma/client";

const substituicaoInclude = {
  substituto: { select: { id: true, name: true } }
} as const;

const ATIVAS: StatusSubstituicao[] = ["PENDENTE", "ACEITA"];

type Db = PrismaClient | Prisma.TransactionClient;

export class SubstituicoesRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Db = prisma
  ) {}

  transaction<T>(fn: (repository: SubstituicoesRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new SubstituicoesRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  findAusenciaById(id: string) {
    return this.db.ausenciaAula.findUnique({
      where: { id },
      select: {
        id: true,
        data: true,
        aula: { select: { professorId: true, diaSemana: true, horarioInicio: true, horarioFim: true } }
      }
    });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id }, select: { id: true, ativo: true, roles: true } });
  }

  findById(id: string) {
    return this.db.substituicao.findUnique({ where: { id } });
  }

  findAtivaByAusencia(ausenciaId: string) {
    return this.db.substituicao.findFirst({ where: { ausenciaId, status: { in: ATIVAS } }, select: { id: true } });
  }

  findAulasOfProfessorNoDia(professorId: string, diaSemana: string) {
    return this.db.aula.findMany({
      where: { professorId, diaSemana },
      select: { horarioInicio: true, horarioFim: true }
    });
  }

  findAtivasDoSubstitutoNaData(substitutoId: string, data: Date) {
    return this.db.substituicao.findMany({
      where: { substitutoId, status: { in: ATIVAS }, ausencia: { data } },
      select: { ausencia: { select: { aula: { select: { horarioInicio: true, horarioFim: true } } } } }
    });
  }

  create(data: { ausenciaId: string; substitutoId: string }, designadoPorId: string) {
    return this.db.substituicao.create({ data: { ...data, designadoPorId }, include: substituicaoInclude });
  }

  remove(id: string) {
    return this.db.substituicao.delete({ where: { id } });
  }
}

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
        aula: { select: { professorId: true, disciplinaId: true, diaSemana: true, horarioInicio: true, horarioFim: true } }
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

  findProfessoresAtivos() {
    return this.db.user.findMany({
      where: { ativo: true, roles: { has: "PROFESSOR" } },
      select: { id: true, name: true, disciplinas: { select: { id: true } } }
    });
  }

  findDisponibilidades(professorIds: string[], diaSemana: string, periodoLetivo: string) {
    return this.db.disponibilidade.findMany({
      where: { professorId: { in: professorIds }, diaSemana, periodoLetivo },
      select: { professorId: true, horarioInicio: true, horarioFim: true }
    });
  }

  findAulasDosProfessores(professorIds: string[]) {
    return this.db.aula.findMany({
      where: { professorId: { in: professorIds } },
      select: { professorId: true, diaSemana: true, horarioInicio: true, horarioFim: true }
    });
  }

  findAtivasDosSubstitutosNoPeriodo(substitutoIds: string[], inicio: Date, fim: Date) {
    return this.db.substituicao.findMany({
      where: { substitutoId: { in: substitutoIds }, status: { in: ATIVAS }, ausencia: { data: { gte: inicio, lt: fim } } },
      select: {
        substitutoId: true,
        ausencia: { select: { data: true, aula: { select: { horarioInicio: true, horarioFim: true } } } }
      }
    });
  }

  findRecusadasByAusencia(ausenciaId: string) {
    return this.db.substituicao.findMany({ where: { ausenciaId, status: "RECUSADA" }, select: { substitutoId: true } });
  }

  create(data: { ausenciaId: string; substitutoId: string }, designadoPorId: string) {
    return this.db.substituicao.create({ data: { ...data, designadoPorId }, include: substituicaoInclude });
  }

  remove(id: string) {
    return this.db.substituicao.delete({ where: { id } });
  }
}

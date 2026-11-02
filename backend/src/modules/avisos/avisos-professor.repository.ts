import { Prisma, type PrismaClient, type StatusParticipacao } from "@prisma/client";
import { aulaOcorrivelSelect, excecaoSelect, registrarRespostaAula } from "../grade-horaria/ocorrencias.db.js";

const convocacaoSelect = {
  id: true,
  aulaId: true,
  dataOriginal: true,
  professorId: true,
  status: true,
  remarcada: true,
  aula: { select: aulaOcorrivelSelect }
} as const;

// Avisos do próprio professor: convocações para aulas (Vou/Não vou) e avisos de retirada (Ciente).
export class AvisosProfessorRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Prisma.TransactionClient | PrismaClient = prisma
  ) {}

  transaction<T>(fn: (repository: AvisosProfessorRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new AvisosProfessorRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  // `hoje`: pré-filtro (a convocação sempre tem uma exceção da ocorrência; o filtro fino por início é no serviço).
  listConvocacoesPendentes(professorId: string, hoje: Date) {
    return this.db.convocacaoAula.findMany({
      where: { professorId, status: "PENDENTE", aula: { excecoes: { some: { data: { gte: hoje } } } } },
      select: convocacaoSelect
    });
  }

  findConvocacao(id: string) {
    return this.db.convocacaoAula.findUnique({ where: { id }, select: convocacaoSelect });
  }

  listExcecoesDasAulas(aulaIds: string[]) {
    return this.db.aulaExcecao.findMany({ where: { aulaId: { in: aulaIds } }, select: excecaoSelect });
  }

  listRetiradasPendentes(userId: string, desde: Date) {
    return this.db.avisoProfessor.findMany({ where: { userId, cienteEm: null, data: { gte: desde } } });
  }

  // Recusar vira o aviso de indisponibilidade da gestão; confirmar apaga-o (mesma regra de PUT /schedule/:id/ocorrencias/:data/resposta).
  responderConvocacao(convocacao: { aulaId: string; dataOriginal: Date; professorId: string }, status: StatusParticipacao) {
    return registrarRespostaAula(this.db, convocacao.aulaId, convocacao.dataOriginal, convocacao.professorId, status as "CONFIRMADO" | "RECUSADO");
  }

  // Devolve false quando o aviso não existe ou não é do professor.
  async marcarCiente(id: string, userId: string, cienteEm: Date) {
    const { count } = await this.db.avisoProfessor.updateMany({ where: { id, userId }, data: { cienteEm } });
    return count > 0;
  }
}

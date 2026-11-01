import type { PrismaClient } from "@prisma/client";
import { aulaOcorrivelSelect, excecaoSelect } from "../grade-horaria/ocorrencias.db.js";

// Leitura das tabelas de outros módulos (aulas, exceções, eventos) para montar os avisos; a única escrita é o "ciente".
export class AvisosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // `desde`: limite inferior seguro para a data original (a ocorrência pode ter sido movida para depois dela).
  listIndisponibilidadesPendentes(desde: Date) {
    return this.prisma.indisponibilidadeAula.findMany({
      where: { cienteEm: null, dataOriginal: { gte: desde } },
      select: {
        id: true,
        dataOriginal: true,
        professorId: true,
        updatedAt: true,
        professor: { select: { id: true, name: true } },
        aula: { select: aulaOcorrivelSelect }
      }
    });
  }

  listExcecoesDasAulas(aulaIds: string[]) {
    return this.prisma.aulaExcecao.findMany({ where: { aulaId: { in: aulaIds } }, select: excecaoSelect });
  }

  // `desde`: só eventos a partir desta data (o filtro fino por horário é feito no serviço).
  listRecusasPendentes(desde: Date) {
    return this.prisma.participacaoReuniao.findMany({
      where: { status: "RECUSADO", recusaCienteEm: null, user: { roles: { has: "PROFESSOR" } }, reuniao: { data: { gte: desde } } },
      select: {
        id: true,
        reuniaoId: true,
        user: { select: { id: true, name: true } },
        reuniao: {
          select: {
            titulo: true,
            data: true,
            horarioInicio: true,
            horarioFim: true,
            turmas: { select: { nome: true }, orderBy: { nome: "asc" } }
          }
        }
      }
    });
  }

  // Devolve false quando o aviso não existe.
  async marcarCienteAula(id: string, cienteEm: Date) {
    const atual = await this.prisma.indisponibilidadeAula.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!atual) return false;
    // Preserva updatedAt: ele marca o momento do aviso, usado para detectar alterações posteriores da ocorrência.
    await this.prisma.indisponibilidadeAula.update({ where: { id }, data: { cienteEm, updatedAt: atual.updatedAt } });
    return true;
  }

  async marcarCienteEvento(id: string, cienteEm: Date) {
    const { count } = await this.prisma.participacaoReuniao.updateMany({ where: { id }, data: { recusaCienteEm: cienteEm } });
    return count > 0;
  }
}

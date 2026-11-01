import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AvisoRetiradaInput {
  userId: string;
  tipo: "RETIRADO_AULA" | "RETIRADO_EVENTO";
  titulo: string;
  turma: string | null;
  data: Date;
  horarioInicio: Date;
  horarioFim: Date;
  aulaId?: string;
  dataOriginal?: Date;
  reuniaoId?: string;
}

// Cria o aviso de retirada. Substitui um aviso anterior (ainda sem ciente) do mesmo professor para a mesma
// ocorrência/evento, para não acumular avisos repetidos.
export async function criarAvisoRetirada(db: Db, aviso: AvisoRetiradaInput) {
  await removerAvisosRetirada(db, [aviso.userId], aviso);
  await db.avisoProfessor.create({ data: aviso });
}

// Apaga os avisos de retirada sem ciente dos professores para a ocorrência/evento (ex.: voltaram a ser escalados).
export async function removerAvisosRetirada(
  db: Db,
  userIds: string[],
  alvo: Pick<AvisoRetiradaInput, "tipo" | "aulaId" | "dataOriginal" | "reuniaoId">
) {
  await db.avisoProfessor.deleteMany({
    where: {
      userId: { in: userIds },
      tipo: alvo.tipo,
      cienteEm: null,
      ...(alvo.aulaId ? { aulaId: alvo.aulaId, dataOriginal: alvo.dataOriginal } : { reuniaoId: alvo.reuniaoId })
    }
  });
}

import { Prisma, type PrismaClient } from "@prisma/client";
import { alunoAtivo } from "../matriculas/vigencia.js";
import type { CreateAlunoInput, UpdateAlunoInput } from "./alunos.schemas.js";

const alunoInclude = {
  matriculas: {
    include: { turma: true }
  },
  presencas: true
};

export class AlunosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.aluno.findMany({
      where: alunoAtivo,
      orderBy: { nome: "asc" },
      include: alunoInclude
    });
  }

  findById(id: string) {
    return this.prisma.aluno.findUnique({
      where: { id },
      include: alunoInclude
    });
  }

  // Aluno e matrícula na mesma escrita: não existe aluno sem turma.
  create({ turmaId, ...data }: CreateAlunoInput) {
    return this.prisma.aluno.create({ data: { ...data, matriculas: { create: { turmaId } } } });
  }

  async turmaExists(id: string) {
    return (await this.prisma.turma.count({ where: { id } })) > 0;
  }

  update(id: string, data: UpdateAlunoInput) {
    return this.prisma.aluno.update({ where: { id }, data });
  }

  // Exclusão lógica: marca a remoção (só a primeira vale), libera cpf e email para um recadastro e apaga as notas dele
  // nos simulados ainda não finalizados (nem enviados nem encerrados). Serializável: não corre junto com um envio
  // de correção (conflito vira 409 no errorHandler).
  remover(id: string, removidoEm: Date) {
    return this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.aluno.updateMany({ where: { id, removidoEm: null }, data: { removidoEm, cpf: null, email: null } });
        if (count === 0) return;
        await tx.notaSimulado.deleteMany({ where: { alunoId: id, reuniao: { correcaoEnviadaEm: null, correcaoEncerradaEm: null } } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}

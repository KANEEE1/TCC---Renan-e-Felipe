import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../shared/http.js";
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

  async listIdsAtivos() {
    return (await this.prisma.aluno.findMany({ where: alunoAtivo, select: { id: true } })).map((a) => a.id);
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

  listTurmasDoAno(anoLetivo: number) {
    return this.prisma.turma.findMany({ where: { anoLetivo }, select: { id: true, nome: true } });
  }

  async nomesExistentes(nomes: string[]) {
    const alunos = await this.prisma.aluno.findMany({ where: { ...alunoAtivo, nome: { in: nomes } }, select: { nome: true } });
    return new Set(alunos.map((aluno) => aluno.nome));
  }

  // Tudo ou nada. Os nomes vêm sem repetição (validado antes), então o nome liga cada aluno criado à sua matrícula.
  // Serializável com nova checagem: outra importação não cadastra o mesmo nome no meio (conflito vira 409 no errorHandler).
  importar(novos: { nome: string; numero: string | null; turmaId: string }[]) {
    const turmaPorNome = new Map(novos.map((novo) => [novo.nome, novo.turmaId]));
    return this.prisma.$transaction(
      async (tx) => {
        const repetido = await tx.aluno.findFirst({ where: { ...alunoAtivo, nome: { in: [...turmaPorNome.keys()] } }, select: { nome: true } });
        if (repetido) throw new HttpError(409, `Já existe um aluno chamado "${repetido.nome}". Envie a planilha de novo.`);
        const criados = await tx.aluno.createManyAndReturn({
          data: novos.map(({ nome, numero }) => ({ nome, numero })),
          select: { id: true, nome: true }
        });
        await tx.matricula.createMany({ data: criados.map((aluno) => ({ alunoId: aluno.id, turmaId: turmaPorNome.get(aluno.nome)! })) });
        return criados.length;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
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

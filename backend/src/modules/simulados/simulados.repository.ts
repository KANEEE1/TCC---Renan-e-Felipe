import { Prisma, type PrismaClient } from "@prisma/client";

const matriculaSelect = { alunoId: true, dataMatricula: true, createdAt: true, aluno: { select: { id: true, nome: true } } } as const;

const simuladoSelect = {
  id: true,
  titulo: true,
  data: true,
  horarioInicio: true,
  horarioFim: true,
  local: true,
  pontuacaoMaxima: true,
  prazoCorrecao: true,
  correcaoEnviadaEm: true,
  correcaoEncerradaEm: true,
  correcaoEnviadaPor: { select: { id: true, name: true } },
  // Ordenadas por nome: o aluno em duas turmas fica na primeira (turmaPorAluno).
  turmas: { select: { id: true, nome: true, matriculas: { select: matriculaSelect } }, orderBy: { nome: "asc" } },
  corretores: { select: { id: true, name: true }, orderBy: { name: "asc" } },
  notasSimulado: {
    select: { alunoId: true, turmaId: true, valor: true, ausente: true, automatica: true, aluno: { select: { id: true, nome: true } }, turma: { select: { nome: true } } }
  }
} as const;

// Ainda aberto: nem enviado nem encerrado pelo prazo.
const emAberto = { tipo: "SIMULADO", correcaoEnviadaEm: null, correcaoEncerradaEm: null } as const;

export type SimuladoRow = Prisma.ReuniaoGetPayload<{ select: typeof simuladoSelect }>;

// Simulados são eventos (Reuniao do tipo SIMULADO); este repositório cuida da correção (notas, envio e encerramento).
export class SimuladosRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Prisma.TransactionClient | PrismaClient = prisma
  ) {}

  transaction<T>(fn: (repository: SimuladosRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new SimuladosRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  list() {
    return this.db.reuniao.findMany({
      where: { tipo: "SIMULADO" },
      select: simuladoSelect,
      orderBy: [{ data: "desc" }, { horarioInicio: "desc" }]
    });
  }

  findById(id: string) {
    return this.db.reuniao.findFirst({ where: { id, tipo: "SIMULADO" }, select: simuladoSelect });
  }

  // Simulados em aberto cujo prazo (dia) já passou: os pendentes de encerramento.
  listPrazosVencidos(hoje: Date) {
    return this.db.reuniao.findMany({
      where: { ...emAberto, pontuacaoMaxima: { not: null }, prazoCorrecao: { lt: hoje } },
      select: {
        id: true,
        data: true,
        turmas: { select: { id: true, matriculas: { select: matriculaSelect } }, orderBy: { nome: "asc" } },
        notasSimulado: { select: { alunoId: true } }
      }
    });
  }

  // Encerra pelo prazo e dá zero automático a quem ficou sem registro. Só quem "ganha" a marcação grava os zeros (idempotente).
  // `hoje`: confere de novo que o prazo venceu (uma edição concorrente pode ter mudado o prazo).
  encerrar(id: string, hoje: Date, encerradaEm: Date, zeros: { alunoId: string; turmaId: string }[]) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.reuniao.updateMany({
        where: { id, ...emAberto, prazoCorrecao: { lt: hoje } },
        data: { correcaoEncerradaEm: encerradaEm }
      });
      if (count === 0 || zeros.length === 0) return;
      await tx.notaSimulado.createMany({
        data: zeros.map((zero) => ({ ...zero, reuniaoId: id, valor: 0, ausente: false, automatica: true })),
        skipDuplicates: true
      });
    });
  }

  // `hoje`: pré-filtro pela data (o filtro fino pelo horário de término é no serviço).
  listCorrecoesEmAberto(corretorId: string, hoje: Date) {
    return this.db.reuniao.findMany({
      where: {
        ...emAberto,
        corretores: { some: { id: corretorId } },
        pontuacaoMaxima: { not: null },
        data: { lte: hoje },
        prazoCorrecao: { gte: hoje }
      },
      select: simuladoSelect
    });
  }

  // Encerrados pelo prazo com algum zero automático e sem "ciente" da gestão.
  listEncerramentosSemCiente() {
    return this.db.reuniao.findMany({
      where: { tipo: "SIMULADO", correcaoEncerradaEm: { not: null }, correcaoEncerradaCienteEm: null, notasSimulado: { some: { automatica: true } } },
      select: {
        id: true,
        titulo: true,
        data: true,
        horarioInicio: true,
        horarioFim: true,
        prazoCorrecao: true,
        turmas: { select: { nome: true }, orderBy: { nome: "asc" } },
        _count: { select: { notasSimulado: { where: { automatica: true } } } }
      }
    });
  }

  async marcarCienteEncerramento(id: string, cienteEm: Date) {
    const { count } = await this.db.reuniao.updateMany({
      where: { id, tipo: "SIMULADO", correcaoEncerradaEm: { not: null }, correcaoEncerradaCienteEm: null },
      data: { correcaoEncerradaCienteEm: cienteEm }
    });
    return count > 0;
  }

  // Nota igual à gravada: não mexe no registro (preserva `automatica` e quem lançou).
  async salvarNota(reuniaoId: string, nota: { alunoId: string; turmaId: string; valor: number | null; ausente: boolean }, lancadaPorId: string) {
    const atual = await this.db.notaSimulado.findUnique({
      where: { reuniaoId_alunoId: { reuniaoId, alunoId: nota.alunoId } },
      select: { valor: true, ausente: true }
    });
    if (atual && atual.valor === nota.valor && atual.ausente === nota.ausente) return;
    const dados = { valor: nota.valor, ausente: nota.ausente, automatica: false, lancadaPorId };
    await this.db.notaSimulado.upsert({
      where: { reuniaoId_alunoId: { reuniaoId, alunoId: nota.alunoId } },
      create: { reuniaoId, alunoId: nota.alunoId, turmaId: nota.turmaId, ...dados },
      update: dados
    });
  }

  removerNota(reuniaoId: string, alunoId: string) {
    return this.db.notaSimulado.deleteMany({ where: { reuniaoId, alunoId } });
  }

  async listAlunoIdsComNota(reuniaoId: string) {
    const rows = await this.db.notaSimulado.findMany({ where: { reuniaoId }, select: { alunoId: true } });
    return new Set(rows.map((row) => row.alunoId));
  }

  marcarEnviada(id: string, enviadaEm: Date, enviadaPorId: string) {
    return this.db.reuniao.update({ where: { id }, data: { correcaoEnviadaEm: enviadaEm, correcaoEnviadaPorId: enviadaPorId } });
  }
}

import type { PrismaClient, StatusParticipacao } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import { criarAvisoRetirada, removerAvisosRetirada } from "../avisos/avisos-professor.db.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";

const meetingInclude = {
  criadoPor: { select: { id: true, name: true } },
  participacoes: { include: { user: { select: { id: true, name: true, roles: true } } } },
  turmas: { select: { id: true, nome: true }, orderBy: { nome: "asc" } },
  disciplina: { select: { id: true, nome: true } }
} as const;

type MeetingFields<T extends { participanteIds?: string[]; turmaIds?: string[] }> = Omit<T, "participanteIds" | "turmaIds">;

export class MeetingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listParticipantOptions() {
    return this.prisma.user.findMany({
      where: { ativo: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  }

  list() {
    return this.prisma.reuniao.findMany({
      include: meetingInclude,
      orderBy: [{ data: "asc" }, { horarioInicio: "asc" }]
    });
  }

  listByDate(data: Date) {
    return this.prisma.reuniao.findMany({
      where: { data },
      include: meetingInclude,
      orderBy: { horarioInicio: "asc" }
    });
  }

  findById(id: string) {
    return this.prisma.reuniao.findUnique({ where: { id }, include: meetingInclude });
  }

  async findActiveUserIds(ids: string[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true } });
    return users.map((user) => user.id);
  }

  async findProfessorIds(ids: string[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, roles: { has: "PROFESSOR" } }, select: { id: true } });
    return users.map((user) => user.id);
  }

  async disciplinaExiste(id: string) {
    return (await this.prisma.disciplina.count({ where: { id } })) > 0;
  }

  async countTurmas(ids: string[]) {
    return this.prisma.turma.count({ where: { id: { in: ids } } });
  }

  create(data: MeetingFields<CreateMeetingInput>, criadoPorId: string, convidadoIds: string[], turmaIds: string[]) {
    return this.prisma.reuniao.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim),
        criadoPorId,
        // Quem cria e se inclui no evento já fica confirmado; os demais começam pendentes.
        participacoes: {
          create: convidadoIds.map((userId) => ({ userId, status: userId === criadoPorId ? "CONFIRMADO" : "PENDENTE" }))
        },
        turmas: { connect: turmaIds.map((id) => ({ id })) }
      },
      include: meetingInclude
    });
  }

  update(
    id: string,
    data: MeetingFields<UpdateMeetingInput>,
    editorId: string,
    participanteIds?: string[],
    turmaIds?: string[],
    // Participantes que já estavam no evento antes de uma remarcação: voltam a "pendente" e recebem aviso.
    remarcarIds: string[] = [],
    // Participantes removidos que recebem aviso de retirada (já filtrados: evento futuro, sem o editor).
    retiradosIds: string[] = []
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (remarcarIds.length > 0) {
        await tx.participacaoReuniao.updateMany({
          where: { reuniaoId: id, userId: { in: remarcarIds, not: editorId } },
          data: { status: "PENDENTE", remarcado: true }
        });
      }

      if (participanteIds) {
        await tx.participacaoReuniao.deleteMany({ where: { reuniaoId: id, userId: { notIn: participanteIds } } });
        // Só cria as participações novas (skipDuplicates preserva o status das existentes); quem edita e se
        // inclui fica confirmado.
        await tx.participacaoReuniao.createMany({
          data: participanteIds.map((userId) => ({
            reuniaoId: id,
            userId,
            status: userId === editorId ? ("CONFIRMADO" as const) : ("PENDENTE" as const)
          })),
          skipDuplicates: true
        });
        // Quem volta ao evento deixa de ter aviso de retirada.
        await removerAvisosRetirada(tx, participanteIds, { tipo: "RETIRADO_EVENTO", reuniaoId: id });
      }

      const atualizada = await tx.reuniao.update({
        where: { id },
        data: {
          ...data,
          horarioInicio: data.horarioInicio ? parseTimeToDate(data.horarioInicio) : undefined,
          horarioFim: data.horarioFim ? parseTimeToDate(data.horarioFim) : undefined,
          turmas: turmaIds ? { set: turmaIds.map((turmaId) => ({ id: turmaId })) } : undefined
        },
        include: meetingInclude
      });

      for (const userId of retiradosIds) {
        await criarAvisoRetirada(tx, {
          userId,
          tipo: "RETIRADO_EVENTO",
          titulo: atualizada.titulo,
          turma: atualizada.turmas.length > 0 ? atualizada.turmas.map((turma) => turma.nome).join(", ") : null,
          data: atualizada.data,
          horarioInicio: atualizada.horarioInicio,
          horarioFim: atualizada.horarioFim,
          reuniaoId: id
        });
      }

      return atualizada;
    });
  }

  updateParticipacaoStatus(reuniaoId: string, userId: string, status: StatusParticipacao) {
    return this.prisma.participacaoReuniao.update({
      where: { reuniaoId_userId: { reuniaoId, userId } },
      data: { status, remarcado: false, recusaCienteEm: null }
    });
  }

  // Os avisos de cancelamento são criados na mesma transação (a exclusão leva as participações por cascade).
  remove(id: string, avisos: { userId: string; titulo: string; turma: string | null; data: Date; horarioInicio: Date; horarioFim: Date }[] = []) {
    return this.prisma.$transaction(async (tx) => {
      for (const aviso of avisos) await criarAvisoRetirada(tx, { ...aviso, tipo: "CANCELADO_EVENTO" });
      await tx.reuniao.delete({ where: { id } });
    });
  }
}

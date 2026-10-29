import type { PrismaClient, StatusParticipacao } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";

const meetingInclude = {
  criadoPor: { select: { id: true, name: true } },
  participacoes: { include: { user: { select: { id: true, name: true } } } },
  turmas: { select: { id: true, nome: true }, orderBy: { nome: "asc" } }
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

  findById(id: string) {
    return this.prisma.reuniao.findUnique({ where: { id }, include: meetingInclude });
  }

  async findActiveUserIds(ids: string[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true } });
    return users.map((user) => user.id);
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
        participacoes: {
          create: convidadoIds.map((userId) => ({ userId }))
        },
        turmas: { connect: turmaIds.map((id) => ({ id })) }
      },
      include: meetingInclude
    });
  }

  update(id: string, data: MeetingFields<UpdateMeetingInput>, participanteIds?: string[], turmaIds?: string[]) {
    return this.prisma.$transaction(async (tx) => {
      if (participanteIds) {
        await tx.participacaoReuniao.deleteMany({ where: { reuniaoId: id, userId: { notIn: participanteIds } } });
        await tx.participacaoReuniao.createMany({
          data: participanteIds.map((userId) => ({ reuniaoId: id, userId })),
          skipDuplicates: true
        });
      }

      return tx.reuniao.update({
        where: { id },
        data: {
          ...data,
          horarioInicio: data.horarioInicio ? parseTimeToDate(data.horarioInicio) : undefined,
          horarioFim: data.horarioFim ? parseTimeToDate(data.horarioFim) : undefined,
          turmas: turmaIds ? { set: turmaIds.map((turmaId) => ({ id: turmaId })) } : undefined
        },
        include: meetingInclude
      });
    });
  }

  updateParticipacaoStatus(reuniaoId: string, userId: string, status: StatusParticipacao) {
    return this.prisma.participacaoReuniao.update({
      where: { reuniaoId_userId: { reuniaoId, userId } },
      data: { status }
    });
  }

  remove(id: string) {
    return this.prisma.reuniao.delete({ where: { id } });
  }
}
